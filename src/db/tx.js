const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const {addressSchema} = require('./address')

let txSchema = new Schema(
    {
        txId: {
            type: String
        },
        timestamp: {
            type: Number,
        },
        blockHeight: {
            type: Number,
        },
        data: {
            type: Object
        },

    },
    { collection: "Tx" }
);

module.exports = {
    txModel: mongoose.model("tx", txSchema),
    txSchema
};
