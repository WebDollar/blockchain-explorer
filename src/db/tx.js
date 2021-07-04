const mongoose = require("mongoose");

const Schema = mongoose.Schema;

let tx = new Schema(
    {
        txId: {
            type: String
        },
        data: {
            type: Object
        }
    },
    { collection: "Tx" }
);

module.exports = mongoose.model("tx", tx);
