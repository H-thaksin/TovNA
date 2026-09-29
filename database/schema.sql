-- ============================================
-- TovNa Database Schema
-- ============================================

-- Roles
CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE
);

-- Users
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    role_id INTEGER NOT NULL REFERENCES roles(id),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    phone VARCHAR(30),
    profile_image TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- Destinations
CREATE TABLE destinations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    province VARCHAR(100) NOT NULL,
    description TEXT,
    image_url TEXT,
    latitude DECIMAL(10, 7),
    longitude DECIMAL(10, 7),
    best_time VARCHAR(100),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- Hotels
CREATE TABLE hotels (
    id SERIAL PRIMARY KEY,
    destination_id INTEGER NOT NULL REFERENCES destinations(id),
    name VARCHAR(150) NOT NULL,
    description TEXT,
    address TEXT,
    image_url TEXT,
    price_per_night DECIMAL(10, 2) NOT NULL,
    rating DECIMAL(2, 1),
    total_rooms INTEGER,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- Tours
CREATE TABLE tours (
    id SERIAL PRIMARY KEY,
    destination_id INTEGER NOT NULL REFERENCES destinations(id),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    duration_days INTEGER NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    max_people INTEGER,
    image_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- Activities
CREATE TABLE activities (
    id SERIAL PRIMARY KEY,
    destination_id INTEGER NOT NULL REFERENCES destinations(id),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    duration_hours DECIMAL(4, 1),
    price DECIMAL(10, 2) NOT NULL,
    image_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- Transportations
CREATE TABLE transportations (
    id SERIAL PRIMARY KEY,
    from_destination_id INTEGER NOT NULL REFERENCES destinations(id),
    to_destination_id INTEGER NOT NULL REFERENCES destinations(id),
    type VARCHAR(50) NOT NULL,
    provider VARCHAR(150),
    duration_minutes INTEGER,
    price DECIMAL(10, 2) NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- Itineraries
CREATE TABLE itineraries (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    destination_id INTEGER NOT NULL REFERENCES destinations(id),
    name VARCHAR(200) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    estimated_cost DECIMAL(10, 2) DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- Itinerary Items
CREATE TABLE itinerary_items (
    id SERIAL PRIMARY KEY,
    itinerary_id INTEGER NOT NULL REFERENCES itineraries(id),
    activity_id INTEGER REFERENCES activities(id),
    hotel_id INTEGER REFERENCES hotels(id),
    tour_id INTEGER REFERENCES tours(id),
    day_number INTEGER NOT NULL,
    start_time TIME,
    end_time TIME,
    notes TEXT,
    estimated_cost DECIMAL(10, 2) DEFAULT 0
);
-- Bookings
CREATE TABLE bookings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    booking_reference VARCHAR(50) NOT NULL UNIQUE,
    booking_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- Booking Items
CREATE TABLE booking_items (
    id SERIAL PRIMARY KEY,
    booking_id INTEGER NOT NULL REFERENCES bookings(id),
    hotel_id INTEGER REFERENCES hotels(id),
    tour_id INTEGER REFERENCES tours(id),
    activity_id INTEGER REFERENCES activities(id),
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price DECIMAL(10, 2) NOT NULL,
    total_price DECIMAL(10, 2) NOT NULL
);
-- Payments
CREATE TABLE payments (
    id SERIAL PRIMARY KEY,
    booking_id INTEGER NOT NULL REFERENCES bookings(id),
    amount DECIMAL(10, 2) NOT NULL,
    method VARCHAR(50) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'pending',
    transaction_reference VARCHAR(100),
    paid_at TIMESTAMP
);