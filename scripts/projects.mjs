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
        if(!project.thumbnail.includes("<i")) html_item = html_item.replaceAll("{img}","<img src='images/"+project.thumbnail+"'/>");
        else html_item = html_item.replaceAll("{img}",project.thumbnail);

        content += html_item;
    }

    document.getElementById("projects-list").innerHTML = content;
}