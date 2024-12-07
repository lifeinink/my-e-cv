function expand(id, thisId){
    let element = document.getElementById(id);
    let this_ = document.getElementById(thisId);
    if(element.classList.contains("hidden")){
        element.classList.remove("hidden");
        this_.innerHTML = "▲ Minimise";
    }
    else{
        element.classList.add("hidden");
        this_.innerHTML = "▼ Expand";
    } 
}

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

    const binaryString = atob(base64Str);  // Decode base64 to binary string
    const byteArray = new Uint8Array(binaryString.length);

    // Convert the binary string to a byte array
    for (let i = 0; i < binaryString.length; i++) {
        byteArray[i] = binaryString.charCodeAt(i);
    }
    return byteArray;
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

async function getEncryptedData(){
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
        dataFound = data_as_string.split("<##>").length == 4;
    }
    if(!dataFound){
        return null;
    } else {
        console.log("decrypted data:"+data_as_string);
        return data_as_string;
    }
}

function getScoreHTML(score){
    let html = "<sec class='score' alt='"+score+"'>";
    while(score >= 0.5){
        if(score >= 1){
            score -= 1;
            html += "<i class=\"fa-solid fa-star\"></i>";
        } else {
            score -= 0.5;
            html += "<i class=\"fa-solid fa-star-half\"></i>";
        }
    }
    html += "</sec>";
    return html;
}

function getScore(scoreCode,contents){
    let score_parts = scoreCode.split(":");
    let code = score_parts[0];
    let weights = [];
    if(score_parts.length > 1)weights = score_parts[1].split(",").map(Number);
    else {
        for(let i = 0; i < contents.length;i++){
            weights.push(1);
        }
    }
    if(code == "AVG"){
        let score = 0.0;
        let sample_size = contents.length + 0.0;
        if(weights != []){
            sample_size = weights.reduce((x,y)=>{return x + y},0);
        }
        for(let i = 0; i < contents.length;i++){
            score += (contents[i].score * weights[i])/sample_size;
        }
        return score;
    }
    return 0;
}

function getSkillById(ids){
    let skills = []
    if(skills_json != null){
        for(let i = 0; i < skills_json.content.length && skills.length != skills_json.content.length;i++){
            if(ids.includes(skills_json.content[i].id))skills.push(skills_json.content[i]);
        }
    }
    return skills;
}

function getBucketSkillsHTML(skills,selection,bucket,isInverse,renderFalseToo){
    let renderedHTML = "";
    let falseHTML = "";

    //DEBUG
    /*let bucket_name = "null bucket"
    if(bucket != null){
        bucket_name = bucket.name;
    }*/

    for(var i = 0; i < skills.length;i++){
        let skill = skills[i];
        let is_in_bucket = bucket == null;
        if(!is_in_bucket)is_in_bucket = bucket.content.includes(skill.id);
        if(!is_in_bucket)continue;
        let is_in_selection = selection.includes(skill.id);
        let is_rendered_if_render_only = (is_in_selection && !isInverse) || (isInverse && !is_in_selection);
        if(is_rendered_if_render_only || renderFalseToo){
            let skill_html = skill_template;
            skill_html = skill_html.replaceAll("{title}",skill.name);
            skill_html = skill_html.replaceAll("{stars}",getScoreHTML(skill.score));
            skill_html = skill_html.replaceAll("{desc}",skill.description);


            if(is_rendered_if_render_only){
                renderedHTML += skill_html;
            } else {
                falseHTML += skill_html;
            }
            //Dynamical improvement + allow unselected ones at the end to be processed
            if(selection.includes(skill.id)){
                let index = selection.indexOf(skill.id);
                selection.splice(index,1);
            }
        }
    } 
    return [renderedHTML,falseHTML];
}

function getUnBucketedIDList(total_skills,buckets,selected_ids){
    let bucketed_ids = selected_ids;
    for(let i = 0; i < buckets.length;i++){
        bucketed_ids  = bucketed_ids.concat(buckets[i].content);
    }

    let unbucketed_ids = [];
    for(let i = 0; i < total_skills.length;i++){
        if(!bucketed_ids.includes(total_skills[0].id))unbucketed_ids.push(total_skills[i].id);
    }
    return unbucketed_ids;
}

function truncateHiddenSkills(skills_html){
    skills_html = skills_html.replaceAll("{highlighted_skills}","");
    skills_html = skills_html.replaceAll("{unhighlighted_skills}","");

    if(skills_html.replaceAll("\n","").replaceAll("\r","").replaceAll(" ","").includes("-snapshot\"></ul>")){
        return "";
    }

    if(skills_html.replaceAll("\n","").replaceAll("\r","").replaceAll(" ","").includes("class=\"hiddenscreen-only\"></ul>")){
        return skills_html.split("<nav class=\"screen-only\">")[0] + "</div>";
    }
    else{
        return skills_html;
    }
}

let skill_template = "";
let skill_group_template = "";
let skills_json = null
async function insertSkills(){

    //Get the skills
    if(skill_template == ""){
        let skill_template_r = await fetch("templates/skills/skill.html");
        let skill_group_template_r = await fetch("templates/skills/skill_group.html");
        if(!skill_template_r.ok || !skill_group_template_r.ok)throw new Error("Network error retrieving skill templates");
        skill_template = await skill_template_r.text();
        skill_group_template = await skill_group_template_r.text();
    }
    if(skills_json == null){
        let skills_json_r = await fetch("json/skills.json");
        if(!skills_json_r.ok)throw new Error("Network error retrieving skills");
        skills_json = await skills_json_r.json();
    }

    //Sort skills into those displayed at first and on cv and those that are initially hidden
    let url = new URLSearchParams(window.location.search);
    let selected_skills = [3,2,8,15];
    if(url.has("skills"))selected_skills = url.get("skills").split("-").map(Number);
    let highlighted_buckets = [];
    skills_json.buckets.forEach(bucket => {
        for(let i = 0; i < selected_skills.length;i++){
            let element = selected_skills[i];
            if (bucket.content.includes(element)){
                highlighted_buckets.push(bucket);
                break;
            }
        }
    });

    let total_skills = skills_json.content;

    //Create skills display
    let highlighted_skills_html = "";
    let remaining_selection = getUnBucketedIDList(total_skills,highlighted_buckets,selected_skills);
    //Starting with the skill sections that might be in the highlights and skills that aren't in sections bu are in the cv highlights
    for(let i = 0; i < highlighted_buckets.length; i++){
        let group_template = skill_group_template;
        let contentIds = highlighted_buckets[i].content;
        let score = getScore(highlighted_buckets[i].score,getSkillById(contentIds));
        group_template = group_template.replaceAll("{name}",highlighted_buckets[i].name);
        group_template = group_template.replaceAll("{score}",getScoreHTML(score));

        let skill_html_groups = getBucketSkillsHTML(total_skills,selected_skills,highlighted_buckets[i],false,true);

        group_template = group_template.replaceAll("{highlighted_skills}",skill_html_groups[0]);
        group_template = group_template.replaceAll("{unhighlighted_skills}",skill_html_groups[1]);
        group_template = truncateHiddenSkills(group_template);
        highlighted_skills_html += group_template;
    }

    //Display highlighted skills not in a group
    let highlighted_other_skills = getBucketSkillsHTML(total_skills,selected_skills,null,false,false)[0];

    let ungroup_template = skill_group_template;
    ungroup_template = ungroup_template.replaceAll("{name}","Other");
    ungroup_template = ungroup_template.replaceAll("{score}","");
    ungroup_template = ungroup_template.replaceAll("{highlighted_skills}",highlighted_other_skills);
    ungroup_template = truncateHiddenSkills(ungroup_template);
    highlighted_skills_html += ungroup_template;
    

    document.getElementById("highlighed-skills").innerHTML = highlighted_skills_html;

    //Display buckets of skills that weren't highlighted
    let rest_of_skills_html = "";
    for(let i = 0; i < skills_json.buckets.length; i++){
        if(!highlighted_buckets.includes(skills_json.buckets[i])){
            let other_group = skill_group_template;
            let unhighlighted_group_skills = getBucketSkillsHTML(total_skills,remaining_selection,skills_json.buckets[i],true,false)[0];
            let score = getScore(skills_json.buckets[i].score,getSkillById(skills_json.buckets[i].content));
            other_group = other_group.replaceAll("{name}",skills_json.buckets[i].name);
            other_group = other_group.replaceAll("{score}",getScoreHTML(score));
            other_group = other_group.replaceAll("{highlighted_skills}",unhighlighted_group_skills);
            other_group = truncateHiddenSkills(other_group);
            rest_of_skills_html += other_group;
        }
    }

    //Display the left over skills not in buckets or highlighted
    let unhighlighted_other_skills_html = getBucketSkillsHTML(total_skills,remaining_selection,null,false,false)[0];
    let unhighlighted_other_group_skills_html = skill_group_template;
    unhighlighted_other_group_skills_html = unhighlighted_other_group_skills_html.replaceAll("{name}","Other");
    unhighlighted_other_group_skills_html = unhighlighted_other_group_skills_html.replaceAll("{score}","");
    unhighlighted_other_group_skills_html = unhighlighted_other_group_skills_html.replaceAll("{highlighted_skills}",unhighlighted_other_skills_html);
    unhighlighted_other_group_skills_html = truncateHiddenSkills(unhighlighted_other_group_skills_html);

    rest_of_skills_html += unhighlighted_other_group_skills_html;

    
    document.getElementById("skills").innerHTML = rest_of_skills_html;
    if(rest_of_skills_html == ""){
        document.getElementById("other-skills-title").remove();
        document.getElementById("skills").remove();
    }
}

async function getAddressCoords(address){
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&addressdetails=1`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.length > 0) {
        const location = data[0];
        return [location.lat,location.lon];
    }
}

/*function makeMap(lat1,lon1,lat2,lon2){
    var latm = (parseFloat(lat1) + parseFloat(lat2))/2.0;
    var lonm = (parseFloat(lon1) + parseFloat(lon2))/2.0;
    console.log("Map from "+lat1+","+lon1+" to "+lat2+","+lon2+" centered on "+latm+","+lonm);
    var map = L.map('travel-map').setView([latm, lonm], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    L.Routing.control({
        waypoints: [
            L.latLng(lat1, lon1), // Starting point
            L.latLng(lat2, lon2)  // Destination point
        ]
    }).addTo(map);
}*/

async function getRoutedDistance(lat1,lon1,lat2,lon2){
    const url = `http://router.project-osrm.org/route/v1/driving/${lon1},${lat1};${lon2},${lat2}?overview=false`;

    var result =  await fetch(url);
    var json = await result.json();
    return [json.routes[0].legs[0].distance / 1000.0,json.routes[0].legs[0].duration / 60.0];
}

async function updateLocations(source,destination){
    //Map back when I wanted to try google maps but didn't have an API key
    //let map_html = "<iframe id=\"travel-map\" style=\"border:0;\" allowfullscreen=\"\" src=\"https://www.google.com/maps/embed/v1/directions?origin={source}&destination={dest}\" loading=\"lazy\"></iframe>";
    //map_html = map_html.replaceAll("{source}",source);
    //map_html = map_html.replaceAll("{dest}",destination);

    let map_html = "<div id=\"travel-map\"></div>"

    document.getElementById("transport").innerHTML = document.getElementById("transport").innerHTML.replaceAll("{map}",map_html);

    let coords = await getAddressCoords(source);
    document.getElementById("contact-location-coords").href = "geo:"+coords[0]+","+coords[1]+";u=1170";
    document.getElementById("contact-address-text").innerHTML = source;
    let dest_coords = await getAddressCoords(destination);

    //makeMap(coords[0],coords[1],dest_coords[0],dest_coords[1]);

    var dist_and_duration = await getRoutedDistance(coords[0],coords[1],dest_coords[0],dest_coords[1]);
    document.getElementById("distance-km").innerHTML = dist_and_duration[0].toFixed(2);
    if(dist_and_duration[1] > 60){
        document.getElementById("commute-table").classList.add("hidden");
        document.getElementById("is-relocation").classList.remove("hidden");
    } else {
        if(dist_and_duration[0] <= 6)document.getElementById("bike-commutable").innerHTML = "Yes";
        else document.getElementById("bike-commutable").innerHTML = "No";
        if(dist_and_duration[0] <= 4.5)document.getElementById("walk-commutable").innerHTML = "Yes";
        else document.getElementById("walk-commutable").innerHTML = "No";
    }


    //TODO: get distance between the two locations and update the rest of the transport section
}

async function onCreation(){
    let decryptedData = await getEncryptedData();

    let qr_code_element = document.getElementById("qr-code");
    qr_code_element.href = window.location.toString();
    let qr_code = new QRCode(qr_code_element,{
        text: window.location.toString(),
        colorDark:"#2B7164",
        colorLight: "#d1eee8",
        width: 125,
        height: 125
    });

    let official_url = window.location.pathname;
    let web_link = document.getElementById("contact-web-a");
    web_link.innerHTML = web_link.innerHTML.replaceAll("{web-address}",official_url);

    if(decryptedData == null){
        document.getElementById("contact-phone-li").remove();
        document.getElementById("transport").remove();

        web_link.href = official_url;
    } else {
        let contacts = decryptedData.split("<##>");
        document.getElementById("contact-phone-li").innerHTML = document.getElementById("contact-phone-li").innerHTML.replaceAll("{phone}",contacts[0]);
        let email_link = document.getElementById("contact-email-a");
        email_link.href = email_link.href + "&cc=" + contacts[3];

        web_link.href = window.location.toString();

        updateLocations(contacts[1],contacts[2]);
    }

    try{
        await insertSkills();
    } catch(e){
        console.log("Failure to display skills: "+e);
        document.getElementById("skills-section").remove();
    }
}

function getCV(){
    /*const { jsPDF } = window.jspdf;

    // Create a new jsPDF instance
    const doc = new jsPDF();

    // Convert the body of the page to a PDF
    doc.html(document.body, {
      callback: function (doc) {
        // Save the generated PDF
        doc.save('cv.pdf');
      },
      margin: [0, 0, 0, 0],  // Optional: Adjust margins for your layout
      x: 0,  // Optional: Set the starting position of the content
      y: 0   // Optional: Set the starting position of the content
    });*/
    window.print();
}

//Stuff that happens when the page loads
onCreation();