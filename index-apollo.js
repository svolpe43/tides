
var { buildSchema } = require('graphql');
var request = require('request-promise');

const { ApolloServer, gql } = require('apollo-server');

loadData().then((data) => {
    console.log('finished loading data');

    var schema = gql`
        type Query {
            Get(start: String, end: String): Series
        }

        type Series {
            metadata: Metadata
            data: [Point]
        }

        type Metadata {
            start: String
            end: String
            count: Int
        }

        type Point {
            timestamp: String
            predictions: Float
            water_temperature: Float
            water_level: Float
        }
    `;

    var root = {
        Get: (args) => {
            console.log('Series args', args);

            const start = new Date(args.start);
            const end = new Date(args.end);

            const start_index = index_of(start);
            const end_index = index_of(end);

            console.log(`querying data points ${start_index} - ${end_index}`);

            return {
                metadata: {
                    start: args.start,
                    end: args.end,
                    count: end_index - start_index
                },
                data: data.slice(start_index, end_index)
            }
        }
    };

    const server = new ApolloServer({ schema, root });

    server.listen().then(({ url }) => {
        console.log(`Server ready at ${url}`);
    });
});

async function loadData() {

    const host = 'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?';
    const products = ['predictions', 'water_level', 'water_temperature'];
    const api_user = 'slingshot';
    const station = 9410660; // Los Angeles station at the mouth of the Los Angeles Harbor
    const datum = 'msl';
    const units = 'metric';
    const range = parseInt(31 * 24, 10); // max range is 31 days on each API request, convert to hours

    const result = {};

    for (var product of products) {

        // We are grabbing all of 2020 so start with Jan 1st, 2020
        let begin_date = '20200101';
        let last_date_str = '';

        // loop through the year, grabbing 31 days worth of data each time
        while (true) {
            const uri = `${host}begin_date=${begin_date}&range=${range}&station=${station}&product=${product}&datum=${datum}&units=${units}&time_zone=gmt&application=${api_user}&format=json`
            console.log(`Grabbing ${product} data starting ${begin_date}`);
            const resp = JSON.parse(await request.get(uri));
            const points = product === 'predictions' ? resp.predictions : resp.data

            // Some products dont have prediction data and will not
            // provide data past current date. Some will not return
            // data for certain time periods so catch that case as well.
            if (!points || last_date_str === points[points.length - 1].t) {
                break;
            }

            result[product] = result[product] ? result[product].concat(points) : points;

            // store a string version of the last date so we can easily compare
            // and thus ensure we never concat the same data twice
            last_date_str = result[product][result[product].length - 1].t;
            const last_date = new Date(last_date_str);

            // go until we can ensure we have the entire year of 2020
            // this will grab data slightly into 2021
            if (last_date.getFullYear() === 2021) {
                break;
            }

            // add 6 minutes to the next date so that we dont have overlapping points on concatenation
            begin_date = format_date(last_date.setTime(last_date.getTime() + (6 * 60 * 1000)));
        }
    }

    // summarize the data lengths
    for (var product of Object.keys(result)) {
        console.log(`product: ${product}`);
        console.log(`     len: ${result[product].length}`)
        console.log(`     temporal range: ${result[product][0]["t"]} - ${result[product][result[product].length - 1]['t']}`);
    }

    // Combine multiple data sources into one time series array,
    // Each product could have a different length of data so loop
    // until they are all exhausted. This is so that we do not have
    // to loop through the data set on every query to aggregate. This
    // is especially helpful when the queried time range is very large.
    return normalize(result);
}

function normalize(input) {
    const normalized = [];
    let i = 0;
    while (true) {
        const point = {};
        let exhausted = false
        // todo: it would be good to validate that all timestamps
        // on the combined data points are exactly the same but
        // I don't think that was ever the case.
        for (var product of Object.keys(input)) {
            if (input[product][i]) {
                if (!point['timestamp']) {
                    point['timestamp'] = input[product][i].t;
                }
                point[product] = input[product][i].v;
            } else {
                exhausted |= true;
            }
        }
        normalized.push(point);
        // we have exhausted all data in all the products
        if (exhausted){
            break;
        }
        i++;
    }
    return normalized;
}

// ms -> sec -> min -> 6 min intervals (API gives data points 6 min apart)
function index_of(t) {
    const first = new Date('2020-01-01');
    return (t - first) / 1000 / 60 / 6;
}

// converts a date object into a timestamp that
// can be used with the tidal data API
// yyyyMMdd HH:mm
function format_date(date) {
    var d = new Date(date);
    var month = '' + (d.getMonth() + 1);
    var day = '' + d.getDate();
    var year = d.getFullYear();
    var hour = d.getHours();
    var min = d.getMinutes();

    if (month.length < 2) month = '0' + month;
    if (day.length < 2) day = '0' + day;
    if (hour < 10) hour = '0' + String(hour);
    if (min < 10) min = '0' + String(min);

    return [year, month, day].join('') + ' ' + hour + ':' + min;
}