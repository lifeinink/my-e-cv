function startLoadingSplash(){
    document.getElementById("loading-splash").classList.remove("hidden");
}
function finishLoadingSplash(){
    document.getElementById("loading-splash").classList.add("hidden");
}

async function getListTemplate(){
    let retrieval = await fetch("templates/projects/project_thumb.html");
    if(!retrieval.ok)throw new Error("Network error, unable to retrieve project list template");
    return retrieval.text();
}

export async function  insertProjectList(){
    let retrieval = await fetch("json/projects.json");
    if(!retrieval.ok)throw new Error("Network error, unable to retrieve project information");
    let projects = await retrieval.json();
    let template = await getListTemplate();

    let content = "";

    for(let i = 0; i < projects.content.length;i++){
        let project = projects.content[i];
        let html_item = template;

        let skills_html = "";
        for(let j = 0; j < project.skills.length;j++){
            skills_html += "<li>"+project.skills[j]+"</li>";
        }

        html_item = html_item.replaceAll("{skills}",skills_html);
        html_item = html_item.replaceAll("{title}",project.title);
        html_item = html_item.replaceAll("{summary}",project.summary);
        html_item = html_item.replaceAll("{content}",project.content);
        if(!project.thumbnail.includes("<i")) html_item = html_item.replaceAll("{img}","<img src='images/"+project.thumbnail+"'/>");
        else html_item = html_item.replaceAll("{img}",project.thumbnail);

        content += html_item;
    }

    document.getElementById("projects-list").innerHTML = content;
}

async function getMarkdown(src){
    if(src == "")throw new Error("Can't retrieve markdown that doesn't exist");
    let response_markdown = await fetch("markdown/"+src);
    if(!response_markdown.ok){
        throw new Error("Failed to display markdown because it doesn't exist or there was a network error");
    }
    return await response_markdown.text();
}

function getMD2HTMLConverter(){
    window.converter = new markdownit();
    window.converterStack = [];

    //  1. custom sections for headers with corripsonding chart nodes
    window.converter.renderer.rules.heading_open = function (tokens, idx) {
        const token = tokens[idx];
        const level = parseInt(token.tag.slice(1)) + 2;
        let title = tokens[idx + 1].content;
        let html = "";
        if(window.converterStack.length > 0){
            while(window.converterStack[window.converterStack.length - 1] >= level){
                html += "</section>";
                window.converterStack.pop();
            }
        }
        if(title.includes("::")){
            let title_parts = title.split("::");
            title = title_parts[0];
            let id = title_parts[1];
            html += `<section id="canvas_${id}">`;
            window.converterStack.push(level);
        }
        return html+`<h${level}>`;
    }
    /*window.converter.renderer.rules.heading_close = function (tokens, idx) {
        const token = tokens[idx];
        return `</h${token.tag}>`;
    };*/
    const originalText = window.converter.renderer.rules.text || function (tokens, idx, options, env, self) {
        return self.renderToken(tokens, idx, options);
      };
      window.converter.renderer.rules.text = function (tokens, idx, options, env, self) {
        let content = tokens[idx].content;
      
        if (content.includes('::')) {
          content = content.split("::")[0];
        }
      
        tokens[idx].content = content;
        return originalText(tokens, idx, options, env, self);
      };

    //  2. code of different languages to be compatible with highlight should work automatically

    //  3. mermaid charts using the mermaid interface (TODO)
    window.chart_count = 0;
    window.converter.renderer.rules.fence = (tokens, idx, options, env, self) => {
        const token = tokens[idx];
        const language = token.info.trim() || 'plaintext'; // Get the language, default to 'plaintext'
        const content = token.content.trim(); // Get the code content

        if(language == "mermaid"){
            let id = window.chart_count;
            window.chart_count+=1;
            return `<section id='chart_${id}' class='chart-section'><div class='mermaid' id='mermaid_${id}'>${window.converter.utils.escapeHtml(content)}</div><div class='mermaid-highlight highlight-none' id='highlight_${id}'></div></section>`;
        }
    
        // Custom rendering logic
        return `<pre><code class="language-${language}">${window.converter.utils.escapeHtml(content)}</code></pre>`;
    };

}

function convertMarkdownToHTML(markdown){
    if(typeof window.converter == 'undefined')getMD2HTMLConverter();
    let html = window.converter.render(markdown);
    while(window.converterStack.length > 0){
        html += "</section>";
        window.converterStack.pop();
    }
    return html;
}

function displaySecretContent(content){
    let secret_window = document.getElementById('secret-content')
    if(secret_window.classList.contains("hidden")){
        secret_window.classList.remove('hidden');
    }
    document.getElementById("secret-content-window").innerHTML = content;
}

async function renderCharts(){
    await mermaid.run();
    let elements = document.getElementsByClassName('mermaid');
    Array.from(elements).forEach(element => {
        let id = element.id.split("_")[1];
        //mermaid.init(undefined, element);
        const nodes = element.querySelectorAll('.node');
        nodes.forEach(node => {
            node.addEventListener('click', (event) => {
                const nodeName = node.getAttribute("data-id");
                // Add your custom logic here
                let section = document.getElementById(`canvas_${nodeName}`);
                let content = "";
                if(section != null)content = section.innerHTML;
                let highlight_area = document.getElementById(`highlight_${id}`);
                if(highlight_area == null)throw new Error("Couldn't locate the highlight area for the chart");
                if(content == "" && ! highlight_area.classList.contains("highlight-none"))highlight_area.classList.add("highlight-none");
                else if(content != "" && highlight_area.classList.contains("highlight-none"))highlight_area.classList.remove("highlight-none");
                highlight_area.innerHTML = content;
            });
        });
    });

    // Apply Highlight.js to all code blocks
    document.querySelectorAll('pre code').forEach((block) => {
        hljs.highlightElement(block);
    });
}

export async function openMD(content_src){
    startLoadingSplash();
    if(window.scripts_loaded == false){
        finishLoadingSplash();
        window.alert("Still loading libraries, please wait a bit then try again");
        throw new Error("Can't open projects until supporting libraries are loaded");
    }
    try{
    let markdown = await getMarkdown(content_src);
    displaySecretContent(convertMarkdownToHTML(markdown));
    renderCharts();
    } catch(e){
        console.error(e.stack);
    }
    finishLoadingSplash();
}