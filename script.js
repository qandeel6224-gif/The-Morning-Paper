let selectedTopics = [];

// Highly Reliable Direct RSS Feeds (No-blocking sources)
const topicFeeds = {
    "Technology": "https://feeds.feedburner.com/TechCrunch/",
    "Cybersecurity": "https://feeds.feedburner.com/TheHackersNews",
    "Artificial Intelligence": "https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml",
    "World News": "https://rss.nytimes.com/services/xml/rss/nyt/World.xml",
    "Business": "https://rss.nytimes.com/services/xml/rss/nyt/Business.xml",
    "Science": "https://rss.nytimes.com/services/xml/rss/nyt/Science.xml",
    "Health": "https://rss.nytimes.com/services/xml/rss/nyt/Health.xml",
    "Space": "https://www.sciencedaily.com/rss/space_time/astronomy.xml"
};

function selectTopic(button, topic) {
    if (selectedTopics.includes(topic)) {
        selectedTopics = selectedTopics.filter(item => item !== topic);
        button.classList.remove("selected");
    } else {
        selectedTopics.push(topic);
        button.classList.add("selected");
    }
}

// Multi-Proxy Fallback & Multi-Format XML Parser (RSS & Atom)
async function fetchArticlesForTopic(rssUrl) {
    const proxyList = [
        `https://api.allorigins.win/get?url=${encodeURIComponent(rssUrl)}`,
        `https://corsproxy.io/?${encodeURIComponent(rssUrl)}`
    ];

    for (let proxyUrl of proxyList) {
        try {
            const response = await fetch(proxyUrl);
            if (!response.ok) continue;

            let rawXml = "";
            if (proxyUrl.includes("allorigins")) {
                const json = await response.json();
                rawXml = json.contents;
            } else {
                rawXml = await response.text();
            }

            if (!rawXml) continue;

            // Browser-native XML DOM Parser
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(rawXml, "text/xml");
            
            // Check for RSS <item> or Atom <entry>
            const items = xmlDoc.querySelectorAll("item, entry");
            if (items.length === 0) continue;

            let articles = [];
            items.forEach((item, index) => {
                if (index < 3) { // Get top 3 stories per category
                    const title = item.querySelector("title")?.textContent || "Untitled Article";
                    
                    // Flexible link extraction
                    let link = "#";
                    const linkNode = item.querySelector("link");
                    if (linkNode) {
                        link = linkNode.textContent || linkNode.getAttribute("href") || "#";
                    }

                    // Flexible snippet extraction
                    let description = item.querySelector("description, summary, content")?.textContent || "";
                    
                    articles.push({ title, link, description });
                }
            });

            if (articles.length > 0) {
                return articles;
            }
        } catch (err) {
            console.warn(`Proxy fail: ${proxyUrl}`, err);
        }
    }

    return [];
}

async function showNews() {
    if (selectedTopics.length === 0) {
        alert("Please select at least one topic!");
        return;
    }

    let container = document.getElementById("newsContainer");
    container.innerHTML = "<p style='color:#00ffff;'>⌛ Fetching today's personalized edition...</p>";

    document.getElementById("choicePage").style.display = "none";
    document.getElementById("newsPage").style.display = "block";
    window.scrollTo(0, 0);

    container.innerHTML = "";

    for (let topic of selectedTopics) {
        let rssUrl = topicFeeds[topic];
        if (!rssUrl) continue;

        let articles = await fetchArticlesForTopic(rssUrl);

        let topicBox = document.createElement("div");
        topicBox.className = "news-box";
        topicBox.innerHTML = `<h3>${topic}</h3>`;

        if (articles.length === 0) {
            topicBox.innerHTML += `<p style="color:#aaa;">Unable to load live articles for this topic right now.</p>`;
        } else {
            articles.forEach(item => {
                // Strip HTML tags from RSS snippet text
                let cleanDesc = item.description.replace(/<[^>]*>?/gm, '').trim();
                if (cleanDesc.length > 160) {
                    cleanDesc = cleanDesc.substring(0, 160) + '...';
                }
                if (!cleanDesc) cleanDesc = "Click 'Read Full Story' to view full article content.";

                topicBox.innerHTML += `
                    <div class="article-card">
                        <strong>${item.title}</strong>
                        <p style="font-size: 0.9rem; color: #ccc; margin: 8px 0;">${cleanDesc}</p>
                        <a href="${item.link}" target="_blank" rel="noopener">Read Full Story →</a>
                        <div class="feedback-btns">
                            <button class="btn-sm" onclick="recordUserFeedback('${item.link}', 'upvote')">👍 More like this</button>
                            <button class="btn-sm" onclick="recordUserFeedback('${item.link}', 'downvote')">👎 Less like this</button>
                        </div>
                    </div>
                `;
            });
        }
        container.appendChild(topicBox);
    }
}

// Learning Feedback Signal Tracker
function recordUserFeedback(articleId, signal) {
    let userPreferences = JSON.parse(localStorage.getItem('userPreferences') || '{}');
    userPreferences[articleId] = signal;
    localStorage.setItem('userPreferences', JSON.stringify(userPreferences));
    alert(`Feedback saved (${signal})! User preference recorded.`);
}

// PDF Exporter Engine
function downloadPaperPDF() {
    const element = document.getElementById('newsPage');
    const opt = {
        margin:       0.5,
        filename:     'My_Morning_Paper.pdf',
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2 },
        jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(element).save();
}

function goBack() {
    document.getElementById("newsPage").style.display = "none";
    document.getElementById("choicePage").style.display = "block";
    window.scrollTo(0, 0);
}