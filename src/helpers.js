module.exports = {
    sleep(ms){
        return new Promise( res => setTimeout(res, ms));
    },

    isNumeric (value) {
        return /^-?\d+$/.test(value);
    },

}
