const mongoose = require("mongoose");

const Schema = mongoose.Schema;

let chain = new Schema(
    {
        height: {
            type: Number
        },
        hash: {
            type: String
        },
    },
    { collection: "Chain" }
);

module.exports = mongoose.model("chain", chain);
