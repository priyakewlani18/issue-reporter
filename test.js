const convert = require("./src/tableconvertor")

data = [{image:"NON",word:9 }, {image:"NON",word:9 }]


res = convert(data)
console.log(typeof(res))
console.log(res)