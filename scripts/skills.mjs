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
        if(!bucketed_ids.includes(total_skills[i].id))unbucketed_ids.push(total_skills[i].id);
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
export async function insertSkills(){

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
    let remaining_selection = getUnBucketedIDList(total_skills,skills_json.buckets,selected_skills);
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
            let unhighlighted_group_skills = getBucketSkillsHTML(total_skills,selected_skills,skills_json.buckets[i],true,false)[0];
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