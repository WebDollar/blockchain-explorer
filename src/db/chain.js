const mongoose = require("mongoose");

const Schema = mongoose.Schema;

let chainSchema = new Schema(
    {
        height: {
            type: Number
        },
        hash: {
            type: String
        },
        circulatingSupply: {
            type: Number,
            default: 0,
        },
        transactionsCount: {
            type: Number,
            default: 0,
        },
    },
    { collection: "Chain" }
);

module.exports = {
    chainModel: mongoose.model("Chain", chainSchema),
    chainSchema,
};
