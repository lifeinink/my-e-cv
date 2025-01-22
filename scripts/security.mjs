function getMonthsToTry(){
    let months = [];
    let date = new Date()
    months[0] = date.toLocaleString('default', { month: 'long' });
    date.setMonth(date.getMonth()+1);
    months[1] = date.toLocaleString('default', { month: 'long' });
    date.setMonth(date.getMonth()-2);
    months[2] = date.toLocaleString('default', { month: 'long' });

    return months;
}

function uint8ArrayToHex(uint8Array) {
    return Array.from(uint8Array)
        .map(byte => byte.toString(16).padStart(2, '0')) // Convert each byte to hex and pad with 0
        .join(''); // Combine into a single string
}

function arrayBufferToBase64(array) {
    const binaryString = String.fromCharCode.apply(null, array);
    return btoa(binaryString)
        .replace(/\+/g, '-')  // Replace + with - for URL-safe encoding
        .replace(/\//g, '_')  // Replace / with _ for URL-safe encoding
        .replace(/=+$/, '');  // Remove padding
}

function urlSafeBase64ToUint8Array(base64Str) {
    base64Str = base64Str.replaceAll(/-/g,"+");
    base64Str = base64Str.replaceAll(/_/g,"/");

    while(base64Str.length % 4 != 0){
        base64Str = base64Str + "=";
    }

    return base64ToUint8Array(base64Str);
}

function base64ToUint8Array(base64String) {
    // Decode the Base64 string to a binary string
    const binaryString = atob(base64String);

    // Create a Uint8Array and populate it
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }

    return bytes;
}

async function makeHash(plainText){
    const encoder = new TextEncoder();
    const bytes = encoder.encode(plainText);
    const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
    const hashArray = new Uint8Array(hashBuffer);
    return hashArray
    //const base64Hash = arrayBufferToBase64(hashArray);
}

function capLength(array){
    //let intermediate = decoder.decode(array);
    let allowedLengths = [16,32,2147483646];
    if(array.length < allowedLengths[0])throw Exception("Length of key was less than 16 bytes which should never happen");
    for(var i = 1; i < allowedLengths.length;i++){
        if(array.length < allowedLengths[i])array = array.slice(0,allowedLengths[i-1]);
    }
    return array;
}

export async function getEncryptedData(){
    let url = new URLSearchParams(window.location.search);
    if(!url.has("location") || !url.has("data")) return null;
    let staticSalt = "I should just use something from AWS KMS instead of pasting this in the JS";
    let saltCipher = urlSafeBase64ToUint8Array(url.get("location"));
    let dataCipher = urlSafeBase64ToUint8Array(url.get("data"));
    let dataTag = urlSafeBase64ToUint8Array(url.get("tag"));
    let locTag = urlSafeBase64ToUint8Array(url.get("loctag"));

    let saltCipherCombine = new Uint8Array(saltCipher.byteLength + locTag.byteLength);
    saltCipherCombine.set(saltCipher);
    saltCipherCombine.set(locTag,saltCipher.byteLength);

    let dataCipherCombine = new Uint8Array(dataCipher.byteLength + dataTag.byteLength);
    dataCipherCombine.set(dataCipher);
    dataCipherCombine.set(dataTag,dataCipher.byteLength);

    let months = getMonthsToTry();
    let data;
    let data_as_string;
    let dataFound = false;
    for(var i = 0; i < months.length && !dataFound;i++){
        saltSalt =  new Uint8Array(capLength( await makeHash(months[i]+staticSalt)));
        const formattedSaltSalt = await crypto.subtle.importKey(
            "raw", 
            saltSalt, 
            { name: "AES-GCM" }, 
            false,
            ["decrypt"]
        );
        //Because of the two layer decryption required dependency on url stuff still exists for getting data hence the iv_str being hardcoded doesn't compromise security in this specific case
        //const iv_str = '/r\xd6\x87tx\r\xbb\x82\xa9\x1d\x81\xecnU\xda';
        //const encoder = new TextEncoder();
        //const iv = encoder.encode(iv_str);
        const iv = new Uint8Array([
            0x2F, 0x72, 0xD6, 0x87, 0x74, 0x78, 0x0D, 0xBB,
            0x82, 0xA9, 0x1D, 0x81, 0xEC, 0x6E, 0x55, 0xDA
        ]);
        let raw_key = null;
        try{
        raw_key = await crypto.subtle.decrypt(
            { name: "AES-GCM",
                iv: iv,
                tagLength: 128//Should be equal to 128
             },  
            formattedSaltSalt,
            saltCipherCombine  // The ciphertext in Uint8Array
        );
        } catch(e){
            console.log("Decrytion failed: "+e);
            continue;
        }
        const cappedKey = capLength(new Uint8Array(raw_key));
        //Decrypt the data using the key
        const formattedKey = await crypto.subtle.importKey(
            "raw", 
            cappedKey, 
            { name: "AES-GCM" }, 
            false,
            ["decrypt"]
        );
        try{
            data = await crypto.subtle.decrypt(
                { name: "AES-GCM",
                    iv: iv,
                    tagLength: 128
                }, 
                formattedKey,
                dataCipherCombine  // The ciphertext in Uint8Array
            );
        } catch(e){
            console.log("Decryption failed: "+e)
            continue;
        }
        const decoder = new TextDecoder("utf-8");
        data_as_string = decoder.decode(data)
        dataFound = data_as_string.split("<##>").length >= 4;
    }
    if(!dataFound){
        return null;
    } else {
        console.log("decrypted data:"+data_as_string);
        return data_as_string;
    }
}