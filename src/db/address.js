const mongoose = require("mongoose");

const Schema = mongoose.Schema;

let addressSchema = new Schema(
    {
        address: {
            type: String,
            index: true,
        },
        balance: {
            type: Number,
            default: 0,
        },
        nonce: {
            type: Number,
            default: 0,
        },
        txs: {
            type: Number,
            default: 0,
        },
        totalSent: {
            type: Number,
            default: 0,
        },
        totalReceived: {
            type: Number,
            default: 0,
        },
        totalMinedSolo: {
            type: Number,
            default: 0,
        },
        totalMinedPool: {
            type: Number,
            default: 0,
        },
    },
    { collection: "Address" }
);

module.exports = {
    addressModel: mongoose.model("Address", addressSchema),
    addressSchema,
};
