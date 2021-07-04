const crypto = require('crypto')

module.exports = {

    settings: {

        PRIVATE_KEY:{
            WIF:{
                VERSION_PREFIX : "80", //it is in HEX
                CHECK_SUM_LENGTH : 4, //in bytes
            },
            LENGTH : 64, //ending BASE64 HEX
        },
        PUBLIC_KEY:{
            LENGTH : 32, //ending BASE64 HEX
        },

        ADDRESS:{

            USE_BASE64 : true,

            LENGTH : 20,

            WIF:{
                LENGTH: 0,

                VERSION_PREFIX : "00", //ending BASE64 HEX
                CHECK_SUM_LENGTH : 4, //in bytes   //ending BASE64 HEX

                PREFIX_BASE64 : "584043fe", //BASE64 HEX  WEBD$
                //WEBD  584043
                //WEBD$ 584043FF

                SUFFIX_BASE64 : "FF", //ending BASE64 HEX
                //#w$ EC3F
                //%#$ 8FBF

                PREFIX_BASE58 : "00", //BASE58 HEX and it will be converted to Base64/58
                SUFFIX_BASE58 : "",
            }

        },
    },

    encodeBase64(buffer) {

        if (!Buffer.isBuffer(buffer))
            buffer = Buffer.from(buffer);

        let result = buffer.toString('base64');

        let newStr = '';
        for (let i = 0; i < result.length; i++) {

            if (result[i] === 'O') newStr +=  '#'; else
            if (result[i] === 'l') newStr +=  '@'; else
            if (result[i] === '/') newStr +=  '$';
            else newStr += result[i];

        }

        return newStr;
    },

    toBase(buffer){
        return this.encodeBase64(buffer);
    },

    SHA256(bytes){

        let sha256 = crypto.createHash('sha256'); //sha256
        sha256.update(bytes);

        return sha256.digest();
    },

    _calculateChecksum(privateKeyAndVersion, showDebug){

        //add 0x80 to the front, https://en.bitcoin.it/wiki/List_of_address_prefixes

        if (!Buffer.isBuffer(privateKeyAndVersion) && typeof privateKeyAndVersion === 'string')
            privateKeyAndVersion = Buffer.from(privateKeyAndVersion, 'hex');

        let secondSHA = this.SHA256(this.SHA256(privateKeyAndVersion));
        let checksum = Buffer.alloc(this.settings.PRIVATE_KEY.WIF.CHECK_SUM_LENGTH);
        secondSHA.copy(checksum, 0, 0, this.settings.PRIVATE_KEY.WIF.CHECK_SUM_LENGTH);

        return checksum;
    },

    generateAddressWIF(address, showDebug, toBase = false){

        if (!Buffer.isBuffer(address) && typeof address === "string")
            address = Buffer.from(address, 'hex');

        if ( !Buffer.isBuffer(address) )
            throw {message: "invalid address"};

        let prefix = ( this.settings.ADDRESS.USE_BASE64 ? this.settings.ADDRESS.WIF.PREFIX_BASE64 : this.settings.ADDRESS.WIF.PREFIX_BASE58);
        let suffix = ( this.settings.ADDRESS.USE_BASE64 ? this.settings.ADDRESS.WIF.SUFFIX_BASE64 : this.settings.ADDRESS.WIF.SUFFIX_BASE58);

        //maybe address is already a
        if (address.length === this.settings.ADDRESS.LENGTH + this.settings.ADDRESS.WIF.CHECK_SUM_LENGTH  + this.settings.ADDRESS.WIF.VERSION_PREFIX.length/2 + prefix.length/2 + suffix.length/2)
            return (toBase ? this.toBase(address) : address);

        address = Buffer.concat ( [ Buffer.from(this.settings.ADDRESS.WIF.VERSION_PREFIX,"hex"), address ]) ; //if using testnet, would use 0x6F or 111.

        let checksum = this._calculateChecksum(address, showDebug);

        let addressWIF = Buffer.concat([
            Buffer.from( prefix , "hex"),
            address,
            checksum,
            Buffer.from( suffix, "hex")
        ]);


        return (toBase ? this.toBase(addressWIF) : addressWIF);
    },

    convertAddress(unencodedPublicKeyHash){
        return this.toBase(this.generateAddressWIF(unencodedPublicKeyHash))
    }

}
