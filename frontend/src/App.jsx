import { useEffect, useState } from "react";

function App() {
  const [destinations, setDestinations] = useState([]);
  const [selectedDestination, setSelectedDestination] = useState(null);

  useEffect(() => {
    fetch("http://127.0.0.1:8000/destinations/")
      .then((response) => response.json())
      .then((data) => {
        setDestinations(data);
      })
      .catch((error) => {
        console.error("Error fetching destinations:", error);
      });
  }, []);

  function handleViewDetails(id) {
    fetch(`http://127.0.0.1:8000/destinations/${id}`)
      .then((response) => response.json())
      .then((data) => {
        setSelectedDestination(data);
      })
      .catch((error) => {
        console.error("Error fetching destination:", error);
      });
  }

  return (
    <div>
      <h1>TovNa Destinations</h1>

      {destinations.map((destination) => (
        <div key={destination.id}>
          <img
            src={destination.image_url}
            alt={destination.name}
            style={{
              width: "200px",
              height: "150px",
              objectFit: "cover",
            }}
          />

          <h2>{destination.name}</h2>

          <p>{destination.province}</p>

          <button onClick={() => handleViewDetails(destination.id)}>
            View Details
          </button>
        </div>
      ))}

      {selectedDestination && (
        <div>
          <h2>{selectedDestination.name}</h2>

          <p>{selectedDestination.description}</p>

          <p>
            <strong>Best time:</strong> {selectedDestination.best_time}
          </p>

          <p>
            <strong>Latitude:</strong> {selectedDestination.latitude}
          </p>

          <p>
            <strong>Longitude:</strong> {selectedDestination.longitude}
          </p>

          <img
            src={selectedDestination.image_url}
            alt={selectedDestination.name}
            style={{
              width: "400px",
              maxWidth: "100%",
              height: "auto",
            }}
          />
        </div>
      )}
    </div>
  );
}

export default App;
