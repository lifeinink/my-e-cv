import {getEncryptedData, base64ToUint8Array} from './scripts/security.mjs'
import {insertSkills} from './scripts/skills.mjs'
import {updateLocations} from './scripts/map.mjs'
import {insertProjectList, openMD} from './scripts/projects.mjs'

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

function multiExpand(ids,thisId,expandText,contractText){
    let this_ = document.getElementById(thisId);
    if(this_.innerHTML == expandText)this_.innerHTML = contractText;
    else this_.innerHTML = expandText;
    for(var i = 0; i < ids.length;i++){
        let element = document.getElementById(ids[i]);
        if(element.classList.contains("hidden")){
            element.classList.remove("hidden");
        }
        else{
            element.classList.add("hidden");
        } 
    }
}

function finishLoadingSplash(){
    document.getElementById("loading-splash").classList.add("hidden");
}

let hobbies_dict = {};
async function insertHobbies(){
    let hobby_window = await fetch("templates/hobby_temp.html");
    let hobbies_window = await fetch("json/hobbies.json");
    if(hobby_window.ok && hobbies_window.ok){
        let hobby_template = await hobby_window.text();
        let hobbies = (await hobbies_window.json()).content;
        let hobbies_display = "";
        for(let i = 0; i < hobbies.length;i++){
            let new_hobby = hobby_template;
            hobbies_dict[hobbies[i].name] = hobbies[i];

            //TODO: use generic helper fuction but with index value of zero as is used in caurosel and hobbyImageSelect
            let circles = "<i class=\"fa-solid fa-circle\" onclick=\"hobbyImageSelect('{name}',0)\"></i>";
            for(let j = 1; j < hobbies[i].images.length;j++){
                circles += "<i class=\"fa-regular fa-circle\" onclick=\"hobbyImageSelect('{name}',"+j+")\"></i>";
            }

            new_hobby = new_hobby.replaceAll("{circles}",circles);
            new_hobby = new_hobby.replaceAll("{name}",hobbies[i].name);
            new_hobby = new_hobby.replaceAll("{description}",hobbies[i].description);
            new_hobby = new_hobby.replaceAll("{image}",hobbies[i].images[0]);
            hobbies_display += new_hobby;
        }
        document.getElementById("hobby-grid").innerHTML = hobbies_display;
    } else throw new Exception();
}

//TODO: seperate loader for that content within the display window instead
function startLoadingSplash(){
    document.getElementById("loading-splash").classList.remove("hidden");
}

let file_secret = null;
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

        var secret = "";
        if(contacts.length >= 5)secret = contacts[4];
        if(contacts.length >= 6){
            if(contacts[5].length > 5)file_secret = base64ToUint8Array(contacts[5]);
        }

        updateLocations(contacts[1],contacts[2],secret);
    }

    try{
        await insertSkills();
    } catch(e){
        console.log("Failure to display skills: "+e);
        document.getElementById("skills-section").remove();
    }
    try{
        await insertHobbies();
    } catch(e){
        console.log("Failure to display hobbies: "+e.stack);
        document.getElementById("hobbies").remove();
    }
    try{
        await insertProjectList();
    } catch(e){
        console.log("Failure to display project list: "+e.stack);
        document.getElementById("project-list").remove();
    }
    finishLoadingSplash();
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

function displaySecretContent(content){
    let secret_window = document.getElementById('secret-content')
    if(secret_window.classList.contains("hidden")){
        secret_window.classList.remove('hidden');
    }
    document.getElementById("secret-content-window").innerHTML = content;
}

async function getSecretDisplay(id,dir){
    if(file_secret != null){
        startLoadingSplash();
        let fetching_window = await fetch(dir);
        let cipher_raw = null;
        if(fetching_window.ok){
            cipher_raw = await fetching_window.text();
        } else {
            console.log("Failed to retrieve ciphertext");
            window.alert("Oops, information needed for this action couldn't be retrieved.");
            finishLoadingSplash();
            return;
        }
        let tag_str = document.getElementById(id).innerText;
        const iv = base64ToUint8Array("wrteyd1tKRTVg3HY6gB7Dg==");
        let tag = base64ToUint8Array(tag_str);
        let ciphertext = base64ToUint8Array(cipher_raw);
        let cipher = new Uint8Array(ciphertext.byteLength + tag.byteLength);
        cipher.set(ciphertext);
        cipher.set(tag,ciphertext.byteLength);
        const key = await crypto.subtle.importKey(
            "raw", 
            file_secret, 
            { name: "AES-GCM" }, 
            false,
            ["decrypt"]
        );
        try{
            let plainText = await crypto.subtle.decrypt(
                { name: "AES-GCM",
                    iv: iv,
                    tagLength: 128//Should be equal to 128
                 },  
                key,
                cipher  // The ciphertext in Uint8Array
            );
            const decoder = new TextDecoder("utf-8");
            displaySecretContent(decoder.decode(plainText));
        } catch(e){
            window.alert("Couldn't display content because the token was invalid");
            console.log("Decrytion failed: "+e);
        }
        finishLoadingSplash();
    } else {
        window.alert("You need to access the website from an invitation to view this content");
        console.log("Can't access secrets without key");
    }

}

function hobbyImageSelect(name,index){
    document.getElementById(name+"_hobby_image_index").value = index;
    let circles = "";
    for(let i = 0; i < hobbies_dict[name].images.length;i++){
        if(i != index)circles += "<i class=\"fa-regular fa-circle\" onclick=\"hobbyImageSelect('{name}',"+i+")\"></i>";
        else circles += "<i class=\"fa-solid fa-circle\" onclick=\"hobbyImageSelect('{name}',"+i+")\"></i>";
    }
    circles = circles.replaceAll("{name}",name);
    document.getElementById(name+"_hobby_circles").innerHTML = circles;
    document.getElementById(name+"_hobby_image").src = "images/"+hobbies_dict[name].images[index];
}

function carousel(name,direction){
    //Bug in JS means that -1 % n evaluated as -(1 % n)
    let value = (parseInt(document.getElementById(name+"_hobby_image_index").value) + direction) % hobbies_dict[name].images.length;
    if(value == -1)value = hobbies_dict[name].images.length - 1;
    hobbyImageSelect(name,value);
}

function groupVisibilityToggle(ids){
    for(let i = 0; i < ids.length;i++){
        let element = document.getElementById(ids[i]);
        if(element.classList.contains("hidden"))element.classList.remove("hidden");
        else element.classList.add("hidden");
    }
}

// Utility to load scripts asynchronously and wait for them
function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

async function loadHighlighter(){
    // Load Highlight.js core and Python module
    Promise.all([
        loadScript('https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.8.0/highlight.min.js'),
        loadScript('https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.8.0/languages/python.min.js'),
        loadScript("https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"),
        loadScript("https://cdn.jsdelivr.net/npm/markdown-it/dist/markdown-it.min.js")
    ]).then(() => {

        // Apply Highlight.js to all code blocks
        document.querySelectorAll('pre code').forEach((block) => {
            hljs.highlightElement(block);
        });

        //Initialise Mermaid
        mermaid.initialize({startOnLoad: false});

        window.scripts_loaded = true;
    }).catch((error) => {
        console.error('Error loading Highlight.js, or Mermaid.js scripts:', error);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    window.scripts_loaded = false;
    loadHighlighter();

    //Define externally used functions
    window.expand = expand;
    window.multiExpand = multiExpand;
    window.getCV = getCV;
    window.getSecretDisplay = getSecretDisplay;
    window.carousel = carousel;
    window.groupVisibilityToggle = groupVisibilityToggle;
    window.openMD = openMD;

    onCreation();

  });