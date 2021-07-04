const mongoose = require("mongoose");

const Schema = mongoose.Schema;

let address = new Schema(
    {
        address: {
            type: String
        },
        balance: {
            type: Number
        }
    },
    { collection: "Address" }
);

module.exports = mongoose.model("address", address);
