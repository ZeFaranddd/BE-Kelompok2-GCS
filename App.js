const express = require("express");
const cors = require("cors");
const missionsRoute = require("./routes/missions");

const app = express();
app.use(cors());
app.use(express.json());

// Routing
app.use("/missions", missionsRoute);

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
