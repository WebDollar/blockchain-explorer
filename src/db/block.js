const mongoose = require("mongoose");

const Schema = mongoose.Schema;

let block = new Schema(
    {
        height: {
            type: Number
        },
        hash: {
            type: String
        },
        data: {
            type: Object
        }
    },
    { collection: "Block" }
);

module.exports = mongoose.model("block", block);
