import math
import re
from dataclasses import asdict, dataclass
from decimal import Decimal
from typing import Literal

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import text

from database import engine


router = APIRouter(
    prefix="/recommendations",
    tags=["Recommendations"]
)


# ---------------------------------------------------------------------------
# Types and configuration (tune everything here)
# ---------------------------------------------------------------------------

Interest = Literal["Beach", "Nature", "Food & Culture", "Sightseeing"]
TravelStyle = Literal["Relaxing", "Adventure", "Cultural", "City exploration"]

# Single source of truth: which activity-category words belong to each interest.
CATEGORY_KEYWORDS: dict[str, set[str]] = {
    "Beach": {
        "beach",
        "island",
        "snorkeling",
        "diving",
        "swimming",
    },
    "Nature": {
        "nature",
        "adventure",
        "wildlife",
        "forest",
        "waterfall",
        "mountain",
        "cave",
        "national",
        "park",
    },
    "Food & Culture": {
        "food",
        "culture",
        "temple",
        "history",
        "heritage",
        "museum",
        "traditional",
        "cooking",
    },
    "Sightseeing": {
        "sightseeing",
        "viewpoint",
        "landmark",
        "architecture",
        "monument",
        "scenic",
    },
}

# Words in an activity's NAME that also count towards an interest, even when its
# category says something else (e.g. category "Adventure" + name "Snorkeling
# Experience" counts as Beach). Kept narrower than CATEGORY_KEYWORDS on purpose:
# names are free text, so ambiguous words are left out (for example "national"
# would wrongly match "National Museum" as Nature).
NAME_KEYWORDS: dict[str, set[str]] = {
    "Beach": {"beach", "snorkeling", "snorkelling", "scuba", "diving", "seashore"},
    "Nature": {
        "waterfall", "wildlife", "forest", "jungle", "trekking",
        "hiking", "cave", "mountain", "lake",
    },
    "Food & Culture": {"food", "cooking", "museum", "temple", "pagoda"},
    "Sightseeing": {"viewpoint", "monument", "landmark", "lighthouse"},
}

# Travel styles are expressed in terms of interests, so there is no second
# keyword list to keep in sync.
STYLE_INTERESTS: dict[str, list[str]] = {
    "Relaxing": ["Beach", "Nature"],
    "Adventure": ["Nature"],
    "Cultural": ["Food & Culture"],
    "City exploration": ["Sightseeing", "Food & Culture"],
}

# Score weights (must add up to 1.0)
WEIGHTS = {
    "interest": 0.25,
    "style": 0.10,
    "budget": 0.25,
    "duration": 0.10,
    "availability": 0.15,
    "travel_time": 0.15,
}

# Defaults used when data is missing
NO_TOURS_DURATION_SCORE = 70
NO_FIT_DURATION_SCORE = 40

# Set to True to hide destinations with no route from the starting location.
# Keep False while your transportation data is still incomplete.
HIDE_UNREACHABLE = False

# An interest counts as "fully covered" at this many matching activities.
# 1 = presence-based (one Beach activity is a full Beach match). Raise it to
# reward destinations with more depth.
TARGET_ACTIVITIES_PER_INTEREST = 1

# Cost model
ROUND_TRIP = True  # include the return journey in the cost
DAILY_FOOD_ALLOWANCE = Decimal("10.00")  # per day; set to 0.00 to ignore food
OVER_BUDGET_PENALTY_PER_100_PERCENT = 200  # 150% of budget => 0 budget points

# Destinations costing more than budget x this value are hidden unless the
# request sets include_over_budget (or the destination is the preferred one).
# 1.0 = hide anything above the budget, 1.5 = allow up to 50% over.
MAX_BUDGET_OVERRUN = Decimal("1.0")

PREFERRED_DESTINATION_BONUS = 5

# Guests per room assumed for hotels whose max_guests_per_room is blank.
DEFAULT_ROOM_CAPACITY = 2

# Longest trip to consider, in transport legs (3 = up to 2 transfers,
# e.g. Siem Reap -> Phnom Penh -> Kampot -> Kep).
MAX_ROUTE_LEGS = 3

# Travel-time suitability: the share of the trip's waking hours spent in
# transit (outbound + return). At or below FULL_SCORE_SHARE the score is 100,
# at or above ZERO_SCORE_SHARE it is 0, and it falls linearly in between.
WAKING_MINUTES_PER_DAY = 16 * 60
TRAVEL_FULL_SCORE_SHARE = 0.15
TRAVEL_ZERO_SCORE_SHARE = 0.50

# Placeholder prices of 0 mean "not entered yet", not "free".
TREAT_ZERO_PRICE_AS_UNVERIFIED = True

# False = never guess the return fare: without a real return journey the
# total stays unknown (the known outbound fare is still counted as a partial
# cost). True = assume the return costs the same as the outbound journey.
ASSUME_SYMMETRIC_RETURN = False

# Estimated waiting time between connecting transport services, by the type of
# the service being boarded. Planning estimates, not confirmed schedules.
TRANSFER_WAIT_MINUTES = {
    "BUS": 60,
    "VAN": 60,
    "FERRY": 45,
    "BOAT": 45,
}
DEFAULT_TRANSFER_WAIT_MINUTES = 60


# ---------------------------------------------------------------------------
# Request model
# ---------------------------------------------------------------------------

class RecommendationRequest(BaseModel):
    starting_location_id: int = Field(gt=0)
    budget_per_person: Decimal = Field(gt=0)
    travel_days: int = Field(ge=1, le=30)
    interests: list[Interest] = Field(min_length=1)
    travel_style: TravelStyle
    preferred_destination_id: int | None = None
    # How many people share one hotel room (hotel cost is split between them)
    room_sharing: int = Field(default=1, ge=1, le=4)
    include_starting_location: bool = False
    # Show destinations whose cost is above the budget (normally hidden).
    include_over_budget: bool = False

    @field_validator("preferred_destination_id", mode="before")
    @classmethod
    def treat_zero_as_no_preference(cls, value):
        # Swagger's default example sends 0; treat it as "no preference".
        return None if value in (0, "") else value


@dataclass
class ScoreBreakdown:
    interest: float
    style: float
    budget: float | None  # None = cost unknown, so budget is not scored
    duration: float
    availability: float
    travel_time: float | None = None  # None = travel time unknown

    def total(self) -> float:
        """Weighted total. Components that are None are skipped and the
        remaining weights are rescaled, so unknown data is not penalised."""
        weighted = 0.0
        weight_sum = 0.0
        for name, weight in WEIGHTS.items():
            value = getattr(self, name)
            if value is None:
                continue
            weighted += value * weight
            weight_sum += weight
        return weighted / weight_sum if weight_sum else 0


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def to_float(value):
    return None if value is None else float(value)


def to_decimal(value) -> Decimal:
    return Decimal(str(value))


def category_words(category: str | None) -> set[str]:
    """'Food & Culture' -> {'food', 'culture'}. Whole words only, so
    'Beachfront Dining' does not match 'beach'."""
    return set(re.findall(r"[a-z]+", (category or "").lower()))


def matches_interest(
    category: str | None,
    interest: str,
    name: str | None = None,
) -> bool:
    """True when the activity's category (or, as a fallback, its name) matches
    the interest."""
    if category_words(category) & CATEGORY_KEYWORDS[interest]:
        return True
    return bool(name and category_words(name) & NAME_KEYWORDS[interest])


def count_interest_matches(
    activities: list[dict],
    interests: list[str],
) -> dict[str, int]:
    return {
        interest: sum(
            1 for activity in activities
            if matches_interest(
                activity["category"], interest, activity.get("name")
            )
        )
        for interest in interests
    }


def room_capacity(hotel: dict) -> int:
    """Guests one room holds (DEFAULT_ROOM_CAPACITY when not entered)."""
    capacity = hotel.get("max_guests_per_room")
    return capacity if capacity and capacity > 0 else DEFAULT_ROOM_CAPACITY


def rooms_needed(hotel: dict, group_size: int) -> int:
    """Rooms a group needs in this hotel, e.g. 4 people in 2-guest rooms = 2."""
    return math.ceil(group_size / room_capacity(hotel))


# ---------------------------------------------------------------------------
# Scoring functions (pure, no database: easy to unit test)
# ---------------------------------------------------------------------------

def calculate_interest_score(interest_counts: dict[str, int]) -> float:
    """Average coverage per interest. 1 activity is a weak match, and
    TARGET_ACTIVITIES_PER_INTEREST or more is a full match."""
    if not interest_counts:
        return 0

    coverage = [
        min(count, TARGET_ACTIVITIES_PER_INTEREST)
        / TARGET_ACTIVITIES_PER_INTEREST
        for count in interest_counts.values()
    ]
    return sum(coverage) / len(coverage) * 100


def calculate_style_score(activities: list[dict], travel_style: str) -> float:
    if not activities:
        return 0

    style_interests = STYLE_INTERESTS[travel_style]
    matching = [
        activity for activity in activities
        if any(
            matches_interest(
                activity["category"], interest, activity.get("name")
            )
            for interest in style_interests
        )
    ]
    return len(matching) / len(activities) * 100


def calculate_budget_score(estimated_cost: Decimal | None, budget: Decimal) -> float | None:
    """None when there is no cost information to judge against the budget."""
    if estimated_cost is None:
        return None

    if estimated_cost <= budget:
        return 100

    overrun = float(estimated_cost / budget) - 1  # 0.25 == 25% over budget
    return max(0, 100 - overrun * OVER_BUDGET_PENALTY_PER_100_PERCENT)


def calculate_duration_score(tours: list[dict], travel_days: int) -> float:
    """Prefer tours that fill a good part of the trip."""
    if not tours:
        return NO_TOURS_DURATION_SCORE

    fitting = [t["duration_days"] for t in tours if t["duration_days"] <= travel_days]
    if not fitting:
        return NO_FIT_DURATION_SCORE

    # A 1-day tour on a 7-day trip scores ~66, and a 7-day tour scores 100.
    return 60 + 40 * (max(fitting) / travel_days)


def calculate_travel_time_score(
    total_travel_minutes: int | None, travel_days: int
) -> float | None:
    """How comfortably the journey fits the trip length. None if unknown."""
    if total_travel_minutes is None:
        return None

    share = total_travel_minutes / (travel_days * WAKING_MINUTES_PER_DAY)
    if share <= TRAVEL_FULL_SCORE_SHARE:
        return 100
    if share >= TRAVEL_ZERO_SCORE_SHARE:
        return 0
    return 100 * (TRAVEL_ZERO_SCORE_SHARE - share) / (
        TRAVEL_ZERO_SCORE_SHARE - TRAVEL_FULL_SCORE_SHARE
    )



def estimate_travel_minutes(
    outbound_minutes: int | None, return_minutes: int | None
) -> int | None:
    """Calculate total journey time without assuming a missing return journey."""
    if outbound_minutes is None:
        return None

    if not ROUND_TRIP:
        return outbound_minutes

    if return_minutes is None:
        return None

    return outbound_minutes + return_minutes



def price_status(price) -> str:
    """'unverified' for missing or placeholder zero prices."""
    if price is None or (TREAT_ZERO_PRICE_AS_UNVERIFIED and to_decimal(price) == 0):
        return "unverified"
    return "verified"


def calculate_availability_score(
    has_hotels: bool,
    has_tours: bool,
    has_activities: bool,
    transport_ok: bool,
) -> float:
    available = [has_hotels, has_tours, has_activities, transport_ok]
    return sum(available) / len(available) * 100


# ---------------------------------------------------------------------------
# Data loading
# ---------------------------------------------------------------------------

def group_by_destination(rows) -> dict[int, list[dict]]:
    grouped: dict[int, list[dict]] = {}
    for row in rows:
        grouped.setdefault(row["destination_id"], []).append(dict(row))
    return grouped


def load_catalog(connection, starting_location_id: int) -> dict:
    destinations = connection.execute(
        text("""
            SELECT id, name, province, description, image_url
            FROM destinations
            WHERE is_active = TRUE
            ORDER BY name
        """)
    ).mappings().all()

    # All active hotels are loaded once; they are grouped by destination below.
    hotels = connection.execute(
        text("""
            SELECT
                id,
                destination_id,
                name,
                price_per_night,
                max_guests_per_room
            FROM hotels
            WHERE is_active = TRUE
        """)
    ).mappings().all()

    tours = connection.execute(
        text("""
            SELECT id, destination_id, name, duration_days, price
            FROM tours
            WHERE is_active = TRUE
        """)
    ).mappings().all()

    activities = connection.execute(
        text("""
            SELECT id, destination_id, name, category, price
            FROM activities
            WHERE is_active = TRUE
        """)
    ).mappings().all()

    # The whole active route network: multi-leg trips (for example via the
    # Phnom Penh hub) need more than the routes touching the starting location.
    routes = connection.execute(
        text("""
            SELECT
                id,
                from_destination_id,
                to_destination_id,
                type,
                provider,
                price,
                duration_minutes,
                transfer_wait_minutes
                FROM transportations
            WHERE is_active = TRUE
        """)
    ).mappings().all()

    return {
        "destinations": destinations,
        "hotels": group_by_destination(hotels),
        "tours": group_by_destination(tours),
        "activities": group_by_destination(activities),
        "routes": [dict(route) for route in routes],
    }


# ---------------------------------------------------------------------------
# Cost estimation
# ---------------------------------------------------------------------------

def build_graph(routes: list[dict], reverse: bool = False) -> dict[int, list[tuple[int, dict]]]:
    """Destinations are nodes and each transportation record is a directed
    edge. With reverse=True every edge is flipped, which lets one search find
    the cheapest way *back* to a single destination from everywhere."""
    graph: dict[int, list[tuple[int, dict]]] = {}
    for route in routes:
        source = route["from_destination_id"]
        target = route["to_destination_id"]
        if reverse:
            source, target = target, source
        graph.setdefault(source, []).append((target, route))
    return graph


def cheapest_paths(
    graph: dict[int, list[tuple[int, dict]]],
    origin: int,
    max_legs: int = MAX_ROUTE_LEGS,
) -> dict[int, tuple[Decimal, list[dict]]]:
    """Cheapest path (by total price, at most max_legs legs) from origin to
    every reachable node. Ties go to the path with fewer legs. Returns
    {node: (total_price, [route, ...])}. The origin itself is not included."""
    best: dict[int, tuple[Decimal, list[dict]]] = {}
    frontier = {origin: (Decimal("0"), [], {origin})}

    for _ in range(max_legs):
        next_frontier = {}
        for node, (cost, path, seen) in frontier.items():
            for neighbour, route in graph.get(node, []):
                if neighbour in seen:  # never loop back through a visited place
                    continue
                new_cost = cost + to_decimal(route["price"])
                if neighbour not in next_frontier or new_cost < next_frontier[neighbour][0]:
                    next_frontier[neighbour] = (
                        new_cost, path + [route], seen | {neighbour}
                    )

        for node, (cost, path, _) in next_frontier.items():
            if node not in best or cost < best[node][0]:
                best[node] = (cost, path)

        frontier = next_frontier
        if not frontier:
            break

    return best


def estimate_transfer_wait_minutes(legs: list[dict]) -> int:
    """Estimate waiting time between connecting transport services."""
    if len(legs) <= 1:
        return 0

    total_wait = 0

    # Each connection uses its custom waiting time when available.
    for next_leg in legs[1:]:
        custom_wait = next_leg.get("transfer_wait_minutes")

        if custom_wait is not None:
            total_wait += int(custom_wait)
            continue

        transport_type = str(next_leg.get("type") or "").upper()

        total_wait += TRANSFER_WAIT_MINUTES.get(
            transport_type,
            DEFAULT_TRANSFER_WAIT_MINUTES,
        )

    return total_wait


@dataclass
class TransportEstimate:
    cost: Decimal | None
    options: list[dict]          # direct routes from the start, cheapest first
    return_options: list[dict]   # direct routes back to the start
    available: bool
    status: str                  # not_needed | available | unavailable |
                                 # return_unavailable
    return_basis: str            # not_needed | return_route |
                                 # assumed_same_as_outbound | one_way_only |
                                 # unavailable | return_unavailable
    outbound_legs: list[dict]    # the chosen (cheapest) outbound journey
    return_legs: list[dict]      # the chosen return journey, if one exists
    known_cost: Decimal = Decimal("0")  # transport cost known so far


def format_route_options(routes: list[dict]) -> list[dict]:
    return [
        {
            "id": r["id"],
            "type": r["type"],
            "provider": r["provider"],
            "one_way_price": to_float(r["price"]),
            "duration_minutes": r["duration_minutes"],
        }
        for r in sorted(routes, key=lambda r: to_decimal(r["price"]))
    ]


def describe_route(legs: list[dict], names: dict[int, str]) -> dict | None:
    """Readable multi-leg journey with estimated transfer waiting time."""
    if not legs:
        return None

    durations = [leg["duration_minutes"] for leg in legs]

    vehicle_minutes = (
        None if None in durations else sum(durations)
    )

    transfer_wait_minutes = estimate_transfer_wait_minutes(legs)

    total_estimated_minutes = (
        None
        if vehicle_minutes is None
        else vehicle_minutes + transfer_wait_minutes
    )

    route_legs = []

    for index, leg in enumerate(legs):
        # Estimate waiting time before the next transport service.
                # Use custom waiting time when available.
        if index < len(legs) - 1:
            next_leg = legs[index + 1]
            custom_wait = next_leg.get("transfer_wait_minutes")

            if custom_wait is not None:
                wait_after_minutes = int(custom_wait)
            else:
                next_type = str(next_leg.get("type") or "").upper()

                wait_after_minutes = TRANSFER_WAIT_MINUTES.get(
                    next_type,
                    DEFAULT_TRANSFER_WAIT_MINUTES,
                )
        else:
            wait_after_minutes = 0

        route_legs.append({
            "id": leg["id"],
            "from_destination_id": leg["from_destination_id"],
            "from_name": names.get(leg["from_destination_id"]),
            "to_destination_id": leg["to_destination_id"],
            "to_name": names.get(leg["to_destination_id"]),
            "type": leg["type"],
            "provider": leg["provider"],
            "price": to_float(leg["price"]),
            "duration_minutes": leg["duration_minutes"],
            "estimated_wait_after_minutes": wait_after_minutes,
        })

    return {
        "transfers": len(legs) - 1,
        "total_price": to_float(
            sum(
                (to_decimal(leg["price"]) for leg in legs),
                Decimal("0"),
            )
        ),
        "total_duration_minutes": vehicle_minutes,
        "transfer_wait_minutes": transfer_wait_minutes,
        "total_estimated_duration_minutes": total_estimated_minutes,
        "duration_complete": vehicle_minutes is not None,
        "legs": route_legs,
    }


def build_journey_summary(
    transport: TransportEstimate,
    outbound_route: dict | None,
    return_route: dict | None,
    no_travel: bool,
    outbound_vehicle_minutes: int | None,
    return_vehicle_minutes: int | None,
    outbound_minutes: int | None,
    return_minutes: int | None,
) -> dict:
    """Build a clear journey summary without hiding assumed return details."""

    outbound_cost = (
        0.0 if no_travel
        else outbound_route["total_price"] if outbound_route else None
    )

    return_cost = (
        0.0 if no_travel
        else return_route["total_price"] if return_route
        else outbound_cost
        if transport.return_basis == "assumed_same_as_outbound"
        else None
    )

    # Only use a return duration when an actual return route exists,
    # or when the backend explicitly assumes a symmetric return.
    assumed_return = (
        transport.return_basis == "assumed_same_as_outbound"
    )

    summary_return_vehicle = (
        0 if no_travel
        else return_vehicle_minutes
        if return_route
        else outbound_vehicle_minutes if assumed_return
        else None
    )

    summary_return_minutes = (
        0 if no_travel
        else return_minutes
        if return_route
        else outbound_minutes if assumed_return
        else None
    )

    summary_return_wait = (
        0 if no_travel
        else return_route["transfer_wait_minutes"]
        if return_route
        else outbound_route["transfer_wait_minutes"]
        if assumed_return and outbound_route
        else None
    )

    total_vehicle_minutes = (
        None
        if outbound_vehicle_minutes is None
        or summary_return_vehicle is None
        else outbound_vehicle_minutes + summary_return_vehicle
    )

    total_wait_minutes = (
        None
        if (outbound_route is None and not no_travel)
        or summary_return_wait is None
        else (
            (0 if no_travel else outbound_route["transfer_wait_minutes"])
            + summary_return_wait
        )
    )

    total_estimated_minutes = (
        None
        if outbound_minutes is None or summary_return_minutes is None
        else outbound_minutes + summary_return_minutes
    )

    if not ROUND_TRIP:
        total_vehicle_minutes = outbound_vehicle_minutes
        total_wait_minutes = (
            0 if no_travel
            else outbound_route["transfer_wait_minutes"]
            if outbound_route else None
        )
        total_estimated_minutes = outbound_minutes

    return {
        "status": transport.status,
        "return_basis": transport.return_basis,
        "round_trip": ROUND_TRIP,
        "outbound": {
            "vehicle_minutes": 0 if no_travel else outbound_vehicle_minutes,
            "transfer_wait_minutes": (
                0 if no_travel
                else outbound_route["transfer_wait_minutes"]
                if outbound_route else None
            ),
            "estimated_duration_minutes": (
                0 if no_travel else outbound_minutes
            ),
            "cost": outbound_cost,
            "route": outbound_route,
            "is_assumed": False,
        },
        "return": (
            {
                "vehicle_minutes": summary_return_vehicle,
                "transfer_wait_minutes": summary_return_wait,
                "estimated_duration_minutes": summary_return_minutes,
                "cost": return_cost,
                "route": return_route,
                "is_assumed": assumed_return and return_route is None,
            }
            if ROUND_TRIP and (
                return_route is not None or assumed_return or no_travel
            )
            else None
        ),
        "total": {
            "vehicle_minutes": total_vehicle_minutes,
            "transfer_wait_minutes": total_wait_minutes,
            "estimated_duration_minutes": total_estimated_minutes,
            "transportation_cost": to_float(transport.cost),
        },
    }


def estimate_transportation(
    destination_id: int,
    request: RecommendationRequest,
    outbound_path: list[dict] | None,
    return_path: list[dict] | None,
    direct_outbound: list[dict] | None = None,
    direct_return: list[dict] | None = None,
) -> TransportEstimate:
    """Cost of getting to the destination (and back, if ROUND_TRIP).

    outbound_path / return_path are lists of route legs in travel order (from
    cheapest_paths), or None when no journey exists. The return leg uses a
    real return journey when one exists; otherwise it is assumed to cost the
    same as the outbound journey only if ASSUME_SYMMETRIC_RETURN is True.
    `status` separates "no travel needed" (cost 0) from "no route" (cost
    unknown)."""
    direct_outbound = direct_outbound or []
    direct_return = direct_return or []

    if destination_id == request.starting_location_id:
        return TransportEstimate(
            Decimal("0.00"), [], [], True, "not_needed", "not_needed", [], []
        )

    return_options = format_route_options(direct_return)

    if not outbound_path:
        return TransportEstimate(
            None, [], return_options, False, "unavailable", "unavailable", [], []
        )

    outbound_cost = sum(
        (to_decimal(leg["price"]) for leg in outbound_path), Decimal("0")
    )
    return_legs: list[dict] = []
    status = "available"

    if not ROUND_TRIP:
        cost, basis = outbound_cost, "one_way_only"
    elif return_path:
        return_legs = return_path
        cost = outbound_cost + sum(
            (to_decimal(leg["price"]) for leg in return_path), Decimal("0")
        )
        basis = "return_route"
    elif ASSUME_SYMMETRIC_RETURN:
        cost, basis = outbound_cost * 2, "assumed_same_as_outbound"
    else:
        # Never guess the return fare: the total is unknown, but the outbound
        # fare is still a known cost.
        cost, basis, status = None, "return_unavailable", "return_unavailable"

    return TransportEstimate(
        cost,
        format_route_options(direct_outbound),
        return_options,
        True,
        status,
        basis,
        outbound_path,
        return_legs,
        known_cost=outbound_cost if cost is None else cost,
    )


def estimate_hotel_cost(
    hotels: list[dict],
    nights: int,
    room_sharing: int,
):
    """Cheapest hotel for the group, as a cost per person."""

    if nights <= 0:
        return Decimal("0"), None, False

    if not hotels:
        return None, None, False

    def group_price_per_night(hotel):
        return (
            to_decimal(hotel["price_per_night"])
            * rooms_needed(hotel, room_sharing)
        )

    cheapest = min(hotels, key=group_price_per_night)

    cost = (
        group_price_per_night(cheapest)
        * nights
        / room_sharing
    )

    capacity_assumed = (
        not cheapest.get("max_guests_per_room")
        or cheapest["max_guests_per_room"] <= 0
    )

    return cost, cheapest, capacity_assumed

# ---------------------------------------------------------------------------
# Reasons
# ---------------------------------------------------------------------------

def build_reasons(
    interest_counts: dict[str, int],
    style_score: float,
    request: RecommendationRequest,
    within_budget: bool | None,
    cost_complete: bool,
    hotels: list[dict],
    is_preferred: bool,
    transport_ok: bool = True,
    starting_name: str = "your starting location",
    via: list[str] | None = None,
    travel_minutes: int | None = None,
    travel_score: float | None = None,
) -> list[str]:
    reasons = []

    matched = [
        f"{interest} ({count})"
        for interest, count in interest_counts.items() if count > 0
    ]
    if matched:
        reasons.append("Matches your interests: " + ", ".join(matched) + ".")
    else:
        reasons.append("No activities match your selected interests.")

    if style_score >= 50:
        article = "an" if request.travel_style == "Adventure" else "a"
        reasons.append(
            f"Fits {article} {request.travel_style.lower()} trip."
        )

    if within_budget is None:
        reasons.append("A complete cost estimate is unavailable.")
    elif within_budget:
        reasons.append("Estimated base cost is within your budget.")
    elif cost_complete:
        reasons.append("Estimated base cost is above your budget.")
    else:
        reasons.append(
            "Costs known so far already exceed your budget "
            "(the full estimate is incomplete)."
        )

    if hotels:
        reasons.append("Hotel options are available.")

    if not transport_ok:
        reasons.append(
            f"No transportation route from {starting_name} is available."
        )

    if via:
        reasons.append(f"Reached via {', '.join(via)}.")

    if travel_score is not None and travel_score < 50 and travel_minutes:
        reasons.append(
            f"Long journey: about {travel_minutes / 60:.1f} hours of travel "
            f"in total for a {request.travel_days}-day trip."
        )

    if is_preferred:
        reasons.append("This is your preferred destination.")

    return reasons


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/options")
def get_recommendation_options():
    """Return active destinations and allowed values for the questionnaire."""

    with engine.connect() as connection:
        destinations = connection.execute(
            text("""
                SELECT id, name, province
                FROM destinations
                WHERE is_active = TRUE
                ORDER BY name
            """)
        ).mappings().all()

    return {
        "destinations": [dict(d) for d in destinations],
        "interests": list(CATEGORY_KEYWORDS),
        "travel_styles": list(STYLE_INTERESTS),
    }


@router.get("/data-gaps")
def get_data_gaps():
    """List active destinations that are missing hotels, tours, activities
    or transportation routes, so you know what data to add."""

    with engine.connect() as connection:
        rows = connection.execute(
            text("""
                SELECT
                    d.id,
                    d.name,
                    (SELECT COUNT(*) FROM hotels h
                      WHERE h.destination_id = d.id AND h.is_active = TRUE) AS hotels,
                    (SELECT COUNT(*) FROM tours t
                      WHERE t.destination_id = d.id AND t.is_active = TRUE) AS tours,
                    (SELECT COUNT(*) FROM activities a
                      WHERE a.destination_id = d.id AND a.is_active = TRUE) AS activities,
                    (SELECT COUNT(*) FROM transportations r
                      WHERE r.to_destination_id = d.id AND r.is_active = TRUE) AS routes_in,
                    (SELECT COUNT(*) FROM transportations r
                      WHERE r.from_destination_id = d.id AND r.is_active = TRUE) AS routes_out
                FROM destinations d
                WHERE d.is_active = TRUE
                ORDER BY d.name
            """)
        ).mappings().all()

    labels = {
        "hotels": "no hotels",
        "tours": "no tours",
        "activities": "no activities",
        "routes_in": "no routes arriving here",
        "routes_out": "no routes leaving from here",
    }

    gaps = []
    for row in rows:
        missing = [label for key, label in labels.items() if row[key] == 0]
        if missing:
            gaps.append({
                "id": row["id"],
                "name": row["name"],
                "missing": missing,
            })

    return {"destinations_with_gaps": len(gaps), "gaps": gaps}


@router.post("/")
def get_recommendations(
    request: RecommendationRequest,
    limit: int = Query(default=10, ge=1, le=50),
):
    with engine.connect() as connection:
        starting_location = connection.execute(
            text("""
                SELECT id, name
                FROM destinations
                WHERE id = :destination_id
                  AND is_active = TRUE
            """),
            {"destination_id": request.starting_location_id}
        ).mappings().first()

        if not starting_location:
            raise HTTPException(
                status_code=404,
                detail="Starting destination not found."
            )

        catalog = load_catalog(connection, request.starting_location_id)

    if request.preferred_destination_id is not None and not any(
        d["id"] == request.preferred_destination_id
        for d in catalog["destinations"]
    ):
        raise HTTPException(
            status_code=404,
            detail="Preferred destination not found."
        )

    # Only routes between active destinations count (a route through an
    # inactive hub is not usable).
    names = {d["id"]: d["name"] for d in catalog["destinations"]}
    network = [
        route for route in catalog["routes"]
        if route["from_destination_id"] in names
        and route["to_destination_id"] in names
    ]
    start_id = request.starting_location_id
    out_paths = cheapest_paths(build_graph(network), start_id)
    back_paths = cheapest_paths(build_graph(network, reverse=True), start_id)

    direct_out: dict[int, list[dict]] = {}
    direct_back: dict[int, list[dict]] = {}
    for route in network:
        if route["from_destination_id"] == start_id:
            direct_out.setdefault(route["to_destination_id"], []).append(route)
        elif route["to_destination_id"] == start_id:
            direct_back.setdefault(route["from_destination_id"], []).append(route)

    nights = max(0, request.travel_days - 1)
    food_cost = DAILY_FOOD_ALLOWANCE * request.travel_days
    results = []

    for destination in catalog["destinations"]:
        destination_id = destination["id"]
        is_preferred = destination_id == request.preferred_destination_id
        is_start = destination_id == request.starting_location_id

        # Skip the place the traveler already is, unless they asked for it.
        if is_start and not request.include_starting_location and not is_preferred:
            continue

        # catalog["hotels"] is a dict {destination_id: [hotel, ...]}.
        hotels = catalog["hotels"].get(destination_id, [])
        tours = catalog["tours"].get(destination_id, [])
        activities = catalog["activities"].get(destination_id, [])

        outbound = out_paths.get(destination_id)
        inbound = back_paths.get(destination_id)
        transport = estimate_transportation(
            destination_id,
            request,
            outbound[1] if outbound else None,
            # The reverse search walks back from the start, so flip the legs
            # into travel order (destination -> ... -> start).
            list(reversed(inbound[1])) if inbound else None,
            direct_out.get(destination_id, []),
            direct_back.get(destination_id, []),
        )
        via = [
            names.get(leg["to_destination_id"], f"#{leg['to_destination_id']}")
            for leg in transport.outbound_legs[:-1]
        ]
        outbound_route = describe_route(transport.outbound_legs, names)
        return_route = describe_route(transport.return_legs, names)
        no_travel = transport.status == "not_needed"

        # Vehicle time only (no transfer waiting)
        outbound_vehicle_minutes = (
            0 if no_travel
            else outbound_route["total_duration_minutes"]
            if outbound_route else None
        )
        return_vehicle_minutes = (
            0 if no_travel
            else return_route["total_duration_minutes"]
            if return_route else None
        )

        # Vehicle time plus estimated transfer waiting
        outbound_minutes = (
            0 if no_travel
            else outbound_route["total_estimated_duration_minutes"]
            if outbound_route else None
        )
        return_minutes = (
            0 if no_travel
            else return_route["total_estimated_duration_minutes"]
            if return_route else None
        )

        travel_minutes = (
            0 if no_travel
            else estimate_travel_minutes(outbound_minutes, return_minutes)
        )
        vehicle_travel_minutes = (
            0 if no_travel
            else estimate_travel_minutes(
                outbound_vehicle_minutes,
                return_vehicle_minutes,
            )
        )
        transfer_wait_minutes = (
            None
            if travel_minutes is None or vehicle_travel_minutes is None
            else travel_minutes - vehicle_travel_minutes
        )
        journey_summary = build_journey_summary(
            transport,
            outbound_route,
            return_route,
            no_travel,
            outbound_vehicle_minutes,
            return_vehicle_minutes,
            outbound_minutes,
            return_minutes,
        )

        transport_cost = transport.cost
        transport_ok = transport.available
        transport_status = transport.status
        hotel_cost, cheapest_hotel, capacity_assumed = estimate_hotel_cost(
            hotels, nights, request.room_sharing
        )
        hotel_status = (
            "not_needed" if nights <= 0
            else "ok" if cheapest_hotel
            else "no_hotels"
        )
        hotel_rooms = (
            rooms_needed(cheapest_hotel, request.room_sharing)
            if cheapest_hotel else None
        )
        capacity_assumed = bool(
            cheapest_hotel and not cheapest_hotel.get("max_guests_per_room")
        )

        # The base estimate needs a hotel (or no overnight stay) and a known
        # route.
        estimated_cost = None
        cost_complete = hotel_cost is not None and transport_cost is not None
        if cost_complete:
            estimated_cost = hotel_cost + transport_cost + food_cost

        # Sum of the cost parts we do know (a lower bound on the real cost).
        known_cost = (
            (hotel_cost or Decimal("0"))
            + transport.known_cost
            + food_cost
        )

        if cost_complete:
            cost_status = "complete"
            budget_basis = estimated_cost
        elif hotel_cost is not None or transport.known_cost > 0:
            cost_status = "partial"
            # If what we know already exceeds the budget, it is over budget
            # for certain. Otherwise we cannot judge it yet.
            budget_basis = (
                known_cost if known_cost > request.budget_per_person else None
            )
        else:
            cost_status = "unavailable"
            budget_basis = None

        within_budget = (
            None if budget_basis is None
            else budget_basis <= request.budget_per_person
        )

        if HIDE_UNREACHABLE and not transport_ok and not is_preferred:
            continue

        # Hide destinations above the allowed budget limit (unless the request
        # asks for them or the destination is the preferred one).
        if (
            budget_basis is not None
            and not is_preferred
            and not request.include_over_budget
            and budget_basis > request.budget_per_person * MAX_BUDGET_OVERRUN
        ):
            continue

        interest_counts = count_interest_matches(activities, request.interests)

        scores = ScoreBreakdown(
            interest=calculate_interest_score(interest_counts),
            style=calculate_style_score(activities, request.travel_style),
            budget=calculate_budget_score(budget_basis, request.budget_per_person),
            duration=calculate_duration_score(tours, request.travel_days),
            availability=calculate_availability_score(
                bool(hotels), bool(tours), bool(activities), transport_ok
            ),
            travel_time=calculate_travel_time_score(
                travel_minutes, request.travel_days
            ),
        )

        total_score = scores.total()
        if is_preferred:
            total_score = min(100, total_score + PREFERRED_DESTINATION_BONUS)

        results.append({
            "destination": {
                "id": destination_id,
                "name": destination["name"],
                "province": destination["province"],
                "description": destination["description"],
                "image_url": destination["image_url"],
            },
            "score": round(total_score, 2),
            "score_breakdown": {
                name: None if value is None else round(value, 2)
                for name, value in asdict(scores).items()
            },
            "is_preferred": is_preferred,
            "within_budget": within_budget,
            "reasons": build_reasons(
                interest_counts,
                scores.style,
                request,
                within_budget,
                cost_complete,
                hotels,
                is_preferred,
                transport_ok,
                starting_location["name"],
                via,
                travel_minutes,
                scores.travel_time,
            ),
            
            
            "services": {
                "hotels": len(hotels),
                "tours": len(tours),
                "activities": len(activities),
                "transportation_available": transport_ok,
                "round_trip_available": (
                    transport_ok
                    and (
                        not ROUND_TRIP
                        or transport_status != "return_unavailable"
                    )
                ),
            },


            "journey_summary": journey_summary,
            "travel": {
                "total_minutes": travel_minutes,
                "vehicle_minutes": vehicle_travel_minutes,
                "transfer_wait_minutes": transfer_wait_minutes,
                "share_of_trip_time": (
                    None if travel_minutes is None
                    else round(
                        travel_minutes
                        / (request.travel_days * WAKING_MINUTES_PER_DAY),
                        2,
                    )
                ),
            },
            "estimated_cost": {
                "currency": "USD",
                "round_trip": ROUND_TRIP,
                "room_sharing": request.room_sharing,
                "hotel": to_float(hotel_cost),
                "hotel_id": cheapest_hotel["id"] if cheapest_hotel else None,
                "hotel_name": cheapest_hotel["name"] if cheapest_hotel else None,
                "hotel_status": hotel_status,  # ok | no_hotels | not_needed
                "hotel_rooms_needed": hotel_rooms,
                "hotel_capacity_assumed": capacity_assumed,
                "transportation": to_float(transport_cost),
                "transportation_status": transport_status,
                "return_basis": transport.return_basis,
                "food": to_float(food_cost),
                "base_total": to_float(estimated_cost),
                "known_cost": to_float(known_cost),
                "cost_status": cost_status,
                "transport_options": transport.options,
                "return_options": transport.return_options,
                "outbound_route": outbound_route,
                "return_route": return_route,
                "outbound_cost": (
                    0.0 if no_travel
                    else outbound_route["total_price"] if outbound_route else None
                ),
                "return_cost": (
                    0.0 if no_travel
                    else return_route["total_price"] if return_route else None
                ),
                # Vehicle travel time only (keeps the original field meanings).
                "outbound_duration_minutes": outbound_vehicle_minutes,
                "return_duration_minutes": return_vehicle_minutes,
                # Estimated journey time including transfer waiting.
                "outbound_estimated_duration_minutes": outbound_minutes,
                "return_estimated_duration_minutes": return_minutes,
                # Estimated waiting time between services.
                "outbound_transfer_wait_minutes": (
                    0 if no_travel
                    else outbound_route["transfer_wait_minutes"]
                    if outbound_route else None
                ),
                "return_transfer_wait_minutes": (
                    0 if no_travel
                    else return_route["transfer_wait_minutes"]
                    if return_route else None
                ),
                "optional_tours": [
                    {
                        "id": tour["id"],
                        "name": tour["name"],
                        "duration_days": tour["duration_days"],
                        "price": to_float(tour["price"]),
                        "price_status": price_status(tour["price"]),
                    }
                    for tour in tours
                ],
                "optional_activities": [
                    {
                        "id": activity["id"],
                        "name": activity["name"],
                        "category": activity["category"],
                        "price": to_float(activity["price"]),
                        "price_status": price_status(activity["price"]),
                    }
                    for activity in activities
                ],
            },
        })

    # Highest score first; ties go to the cheaper option, and unknown cost goes last.
    results.sort(
        key=lambda item: (
            -item["score"],
            item["estimated_cost"]["base_total"]
            if item["estimated_cost"]["base_total"] is not None
            else float("inf"),
        )
    )

    return {
        "starting_location": {
            "id": starting_location["id"],
            "name": starting_location["name"],
        },
        "budget_per_person": to_float(request.budget_per_person),
        "travel_days": request.travel_days,
        "total_candidates": len(results),
        "recommendations": results[:limit],
    }