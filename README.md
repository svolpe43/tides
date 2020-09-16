# Tides
GraphQL implementation leveraging the noaa.gov tide data to aid in shipping route calculations.

### Installation
To install this program simply `cd` to the root directory and run `npm install`. This will install the necessary Javascript packages.

### Running
To run this program use the built in command `npm run start` which will run `index.js`, load the tidal data from noaa.gov and then start a server utilizing GraphQL. In your browser, you can then navigate to `http://localhost:4000/graphql` to use GraphiQL. This will allow you to start querying for tide data.

Here is an example GraphQL query. This will query the time series data between the dates specified by the `start` and `end` times, returning some metadata about the data returned as well as a list of data points that fall within the time range.

```
{
  Get(start: "2020-05-01T00:00:00.000Z", end: "2020-05-01T01:00:00.000Z") {
    metadata {
      start
      end
      count
    }
    data {
      timestamp
      water_level
      predictions
      water_temperature 
    }
  }
}
```

The response should return 10 data points at 6 minute intervals which will include a `timestamp`, `water_level`, `predictions` and `water_temperature`.

### Next Steps
There are many other data sets in the noaa.gov website which can be loaded in. These could potentially give great context to the shipping companies when determining which parameters affect the optimal routes. Along with addiing additional data, we can utilize a true time series db, such as InfluxDB, to load in massive amounts of data and ensure it has all the proper DB features such as replication and backups.




