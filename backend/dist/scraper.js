"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isGoogleSearchUrl = isGoogleSearchUrl;
exports.buildCleanSearchUrl = buildCleanSearchUrl;
exports.scrapeWebsite = scrapeWebsite;
exports.scrapeGoogleSearchPlaces = scrapeGoogleSearchPlaces;
const axios_1 = __importDefault(require("axios"));
const cheerio = __importStar(require("cheerio"));
const puppeteer_extra_1 = __importDefault(require("puppeteer-extra"));
const puppeteer_extra_plugin_stealth_1 = __importDefault(require("puppeteer-extra-plugin-stealth"));
puppeteer_extra_1.default.use((0, puppeteer_extra_plugin_stealth_1.default)());
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_REGEX = /(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{2,4}\)?[-.\s]?)?\d{3,4}[-.\s]?\d{3,4}/g;
function isGoogleSearchUrl(url) {
    try {
        const u = url.trim().toLowerCase();
        return (u.includes("google.com/search") ||
            u.includes("google.co.in/search") ||
            u.includes("google.com/maps") ||
            u.includes("udm=1") ||
            u.includes("tbm=lcl"));
    }
    catch (_a) {
        return false;
    }
}
/**
 * Extract search query and start offset from any Google Search URL.
 * Returns a clean minimal search URL to avoid CAPTCHA blocks.
 */
function buildCleanSearchUrl(originalUrl) {
    let query = "it company";
    let startOffset = 0;
    try {
        const u = new URL(originalUrl.startsWith("http") ? originalUrl : `https://${originalUrl}`);
        // Extract query
        const q = u.searchParams.get("q");
        if (q && q.trim()) {
            query = q.trim();
        }
        else if (u.pathname.includes("/maps/search/")) {
            const parts = u.pathname.split("/maps/search/");
            if (parts[1]) {
                query = decodeURIComponent(parts[1].split("/")[0]).replace(/\+/g, " ");
            }
        }
        // Extract start offset (pagination)
        const start = u.searchParams.get("start");
        if (start) {
            const parsed = parseInt(start, 10);
            if (!isNaN(parsed) && parsed >= 0) {
                startOffset = parsed;
            }
        }
    }
    catch (_a) { }
    const pageNumber = Math.floor(startOffset / 20) + 1;
    // Build a clean URL with only essential params — no tracking params that trigger CAPTCHA
    const cleanUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&udm=1&num=20&hl=en&gl=in` +
        (startOffset > 0 ? `&start=${startOffset}` : "");
    return { cleanUrl, query, startOffset, pageNumber };
}
function normalizeUrl(url) {
    let u = url.trim();
    if (!/^https?:\/\//i.test(u)) {
        u = "https://" + u;
    }
    return u;
}
function getDomain(url) {
    try {
        return new URL(url).hostname;
    }
    catch (_a) {
        return "";
    }
}
function cleanText(value) {
    if (!value)
        return "";
    return value.replace(/\s+/g, " ").trim();
}
function detectServices(html, $) {
    const found = new Set();
    // --- Method 1: Targeted Cheerio extraction from the MAIN page ---
    // Pull text from the most signal-rich elements
    const cheerioText = [
        $('title').text(),
        $('meta[name="description"]').attr('content') || '',
        $('meta[property="og:description"]').attr('content') || '',
        $('meta[name="keywords"]').attr('content') || '',
        $('meta[name="twitter:description"]').attr('content') || '',
        $('h1, h2, h3, h4, h5').map((i, el) => $(el).text()).get().join(' '),
        $('nav a, .nav a, .menu a, .navbar a, header a').map((i, el) => $(el).text()).get().join(' '),
        $('li').map((i, el) => $(el).text()).get().join(' '),
        $('[class*="service" i], [class*="Service" i], [id*="service" i]').map((i, el) => $(el).text()).get().join(' '),
        $('[class*="what" i], [class*="offer" i], [class*="solution" i]').map((i, el) => $(el).text()).get().join(' '),
        $('footer').text(),
    ].join(' ');
    // --- Method 2: Full raw text strip from combined HTML (main + /services page) ---
    const plainText = html.replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ');
    // Combine everything lowercased
    const combined = (cheerioText + ' ' + plainText + ' ' + html).toLowerCase();
    const serviceMap = [
        ["Website Development", [
                "website development", "web development", "web design", "website design",
                "web app development", "web application development", "website developer",
                "website builder", "web solutions", "responsive website", "web designing",
                "website designing", "website creation", "web portal", "landing page",
                "wordpress development", "cms development", "static website", "dynamic website",
                "web development company", "website development company"
            ]],
        ["Mobile App Development", [
                "mobile app development", "mobile application development", "mobile application",
                "ios app development", "android app development", "ios app", "android app",
                "flutter app", "react native", "app developer", "mobile development",
                "smartphone app", "mobile solution", "iphone app", "ipad app",
                "cross-platform app", "hybrid app", "native app", "app development company",
                "mobile apps", "mobile app"
            ]],
        ["E-commerce Development", [
                "e-commerce", "ecommerce", "shopify", "woocommerce", "online store",
                "online shop", "magento", "opencart", "bigcommerce", "prestashop",
                "shopping cart", "product listing", "e-commerce development",
                "online shopping", "e-commerce website", "ecommerce website",
                "b2b ecommerce", "b2c ecommerce"
            ]],
        ["Custom Software Development", [
                "custom software", "software development", "custom development",
                "bespoke software", "enterprise software", "saas development",
                "crm development", "erp development", "software solution",
                "it services", "it solutions", "software solutions", "technology solutions",
                "custom application", "business software", "enterprise application",
                "software company", "it company", "technology company"
            ]],
        ["UI/UX Design", [
                "ui/ux", "ui ux", "user interface", "user experience", "ux design",
                "ui design", "figma", "wireframe", "prototype design", "interaction design",
                "product design", "graphic design", "web design", "logo design",
                "branding design", "creative design", "ui/ux design"
            ]],
        ["Digital Marketing", [
                "digital marketing", "seo", "search engine optimization", "google ads",
                "social media marketing", "ppc", "pay per click", "content marketing",
                "email marketing", "online marketing", "sem", "performance marketing",
                "social media management", "facebook ads", "instagram marketing",
                "youtube marketing", "search engine marketing", "online advertising",
                "digital media"
            ]],
        ["Cloud Services", [
                "cloud service", "aws", "amazon web services", "azure", "google cloud",
                "cloud hosting", "cloud computing", "cloud migration", "cloud infrastructure",
                "devops", "kubernetes", "docker", "cloud solutions", "cloud deployment",
                "cloud management", "saas", "paas", "iaas"
            ]],
        ["Cyber Security", [
                "cyber security", "cybersecurity", "information security", "network security",
                "penetration testing", "ethical hacking", "vulnerability assessment",
                "security audit", "firewall", "data protection", "compliance",
                "security solutions", "it security"
            ]],
        ["AI / Machine Learning", [
                "artificial intelligence", "machine learning", "deep learning",
                "natural language processing", "nlp", "computer vision", "ai solution",
                "chatbot", "generative ai", "llm", "neural network", "predictive analytics",
                "data science", "ai development", "ml development", "automation",
                "intelligent automation", "ai-powered", "ai powered"
            ]],
        ["Data Analytics", [
                "data analytics", "business intelligence", "big data", "data visualization",
                "power bi", "tableau", "data warehouse", "etl", "data pipeline",
                "reporting", "dashboard", "data engineering", "data management"
            ]],
        ["QA & Software Testing", [
                "quality assurance", "qa testing", "software testing", "test automation",
                "selenium", "manual testing", "performance testing", "load testing",
                "regression testing", "bug testing", "qa services", "testing services",
                "quality testing", "functional testing"
            ]],
        ["Website Maintenance & Support", [
                "website maintenance", "web support", "site maintenance", "website support",
                "ongoing maintenance", "technical support", "annual maintenance",
                "website management", "amc", "maintenance and support",
                "support and maintenance", "website hosting"
            ]],
        ["Blockchain Development", [
                "blockchain", "smart contract", "nft", "web3", "defi", "cryptocurrency",
                "ethereum", "solana", "blockchain development", "blockchain solution"
            ]],
    ];
    for (const [name, keywords] of serviceMap) {
        for (const kw of keywords) {
            if (combined.includes(kw)) {
                found.add(name);
                break;
            }
        }
    }
    return Array.from(found);
}
function detectTechnologies(html, $) {
    const found = new Set();
    const lower = html.toLowerCase();
    const metaGenerator = $('meta[name="generator"]').attr("content");
    if (metaGenerator) {
        const gen = metaGenerator.toLowerCase();
        if (gen.includes("wordpress"))
            found.add("WordPress");
        if (gen.includes("joomla"))
            found.add("Joomla");
        if (gen.includes("drupal"))
            found.add("Drupal");
        if (gen.includes("wix"))
            found.add("Wix");
        if (gen.includes("squarespace"))
            found.add("Squarespace");
        if (gen.includes("shopify"))
            found.add("Shopify");
    }
    const techMap = [
        ["React", ["react", "__react", "react-dom"]],
        ["Angular", ["ng-version", "angular"]],
        ["Vue.js", ["vue.js", "vuejs", " __vue"]],
        ["Next.js", ["next.js", "_next/"]],
        ["Nuxt", ["nuxt"]],
        ["Gatsby", ["gatsby"]],
        ["jQuery", ["jquery"]],
        ["Bootstrap", ["bootstrap"]],
        ["Tailwind CSS", ["tailwind"]],
        ["Node.js", ["node.js", "nodejs"]],
        ["PHP", ["php"]],
        ["Laravel", ["laravel"]],
        ["Google Analytics", ["googletagmanager", "google-analytics", "gtag"]],
        ["Facebook Pixel", ["facebook.net", "connect.facebook", "fbq"]],
        ["Cloudflare", ["cloudflare"]],
        ["Nginx", ["nginx"]],
        ["Apache", ["apache"]],
        ["Shopify", ["cdn.shopify"]],
        ["Stripe", ["stripe.com", "stripe"]],
        ["PayPal", ["paypal"]],
        ["TypeScript", ["typescript"]],
        ["Webpack", ["webpack"]],
        ["Vite", ["vite"]],
        ["Sass", ["sass"]],
    ];
    for (const [name, patterns] of techMap) {
        for (const p of patterns) {
            if (lower.includes(p)) {
                found.add(name);
                break;
            }
        }
    }
    return Array.from(found);
}
function scrapeWebsite(url) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        const fullUrl = normalizeUrl(url);
        const domain = getDomain(fullUrl);
        let html = "";
        let finalUrl = fullUrl;
        // --- Step 1: Try axios first ---
        try {
            const res = yield axios_1.default.get(fullUrl, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36",
                },
                timeout: 10000,
                maxRedirects: 5,
            });
            html = res.data;
            finalUrl = ((_b = (_a = res.request) === null || _a === void 0 ? void 0 : _a.res) === null || _b === void 0 ? void 0 : _b.responseUrl) || fullUrl;
        }
        catch (e) {
            // axios failed — will use puppeteer below
        }
        // --- Step 2: If axios got thin/empty content (JS-rendered site), use Puppeteer ---
        const tempText = html ? html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '';
        const isContentThin = tempText.length < 800;
        if (!html || isContentThin) {
            let browser;
            try {
                const websiteExecPath = process.env.PUPPETEER_EXECUTABLE_PATH || undefined;
                const hasDisplay = !!process.env.DISPLAY;
                browser = yield puppeteer_extra_1.default.launch({
                    headless: hasDisplay ? false : true,
                    executablePath: websiteExecPath,
                    args: [
                        "--no-sandbox",
                        "--disable-setuid-sandbox",
                        "--disable-blink-features=AutomationControlled",
                        "--disable-dev-shm-usage",
                        "--disable-gpu",
                    ],
                });
                const page = yield browser.newPage();
                yield page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36");
                yield page.setViewport({ width: 1280, height: 900 });
                // Use networkidle2 to wait for JS-rendered content
                yield page.goto(fullUrl, { waitUntil: "networkidle2", timeout: 20000 });
                // Extra wait for lazy-loaded sections
                yield new Promise(resolve => setTimeout(resolve, 2000));
                // Scroll to trigger lazy loading
                yield page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
                yield new Promise(resolve => setTimeout(resolve, 1000));
                html = yield page.content();
                finalUrl = page.url();
                yield browser.close();
            }
            catch (e2) {
                if (browser) {
                    try {
                        yield browser.close();
                    }
                    catch (_) { }
                }
                if (!html)
                    throw new Error(`Could not fetch website ${fullUrl}`);
            }
        }
        // --- Step 3: Also fetch /services page for better service detection ---
        let servicesHtml = '';
        try {
            const baseOrigin = new URL(finalUrl).origin;
            const servicesUrl = `${baseOrigin}/services`;
            const svcRes = yield axios_1.default.get(servicesUrl, {
                headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36" },
                timeout: 6000,
                maxRedirects: 3,
            });
            if (svcRes.status === 200)
                servicesHtml = svcRes.data || '';
        }
        catch (_) { /* /services page not available */ }
        const $ = cheerio.load(html);
        let companyName = cleanText($('meta[property="og:site_name"]').attr("content")) ||
            cleanText($('meta[name="application-name"]').attr("content")) ||
            cleanText($("title").first().text()) ||
            cleanText($("h1").first().text()) ||
            domain;
        if (companyName) {
            const parts = companyName.split(/[-–—|]/)[0].trim();
            if (parts)
                companyName = parts;
        }
        const companyUrl = finalUrl || fullUrl;
        let email = "";
        const emails = new Set();
        $('a[href^="mailto:"]').each((_, el) => {
            const href = $(el).attr("href") || "";
            const m = href.replace("mailto:", "").split("?")[0].trim();
            if (m && EMAIL_REGEX.test(m))
                emails.add(m);
        });
        const emailMeta = cleanText($('meta[name="email"]').attr("content")) ||
            cleanText($('meta[name="contact"]').attr("content"));
        if (emailMeta && EMAIL_REGEX.test(emailMeta))
            emails.add(emailMeta);
        const textMatches = html.match(EMAIL_REGEX) || [];
        textMatches.forEach((m) => {
            if (!m.includes("example.com") &&
                !m.includes(".png") &&
                !m.includes(".jpg")) {
                emails.add(m.toLowerCase());
            }
        });
        email = Array.from(emails)[0] || "";
        let phone = "";
        const phones = new Set();
        $('a[href^="tel:"]').each((_, el) => {
            const href = $(el).attr("href") || "";
            const num = href
                .replace("tel:", "")
                .split("?")[0]
                .replace(/[^\d+]/g, "")
                .trim();
            if (num)
                phones.add(num);
        });
        const phoneMeta = cleanText($('meta[name="phone"]').attr("content")) ||
            cleanText($('meta[name="telephone"]').attr("content"));
        if (phoneMeta)
            phones.add(phoneMeta.replace(/[^\d+]/g, ""));
        const bodyText = $("body").text();
        const phoneMatches = bodyText.match(PHONE_REGEX) || [];
        phoneMatches.forEach((p) => {
            const clean = p.replace(/[^\d+]/g, "");
            if (clean.length >= 7 && clean.length <= 15)
                phones.add(clean);
        });
        phone = Array.from(phones)[0] || "";
        let service = cleanText($('meta[name="description"]').attr("content")) ||
            cleanText($('meta[property="og:description"]').attr("content")) ||
            cleanText($('meta[name="twitter:description"]').attr("content")) ||
            `${companyName} - Official Website`;
        // Detect services from main page HTML + /services subpage HTML combined
        const combinedHtmlForServices = html + ' ' + servicesHtml;
        const detectedServices = detectServices(combinedHtmlForServices, $);
        const technologies = detectTechnologies(html, $);
        return {
            companyName,
            companyUrl,
            companyPhone: phone,
            companyEmail: email,
            service,
            detectedServices,
            technologies,
        };
    });
}
/**
 * Scrape EXACT companies from a Google Search URL (udm=1 places mode).
 * Builds a clean minimal URL from the query + pagination offset to avoid CAPTCHA.
 * Returns exactly the companies visible on that page in the browser.
 */
function scrapeGoogleSearchPlaces(googleUrl) {
    return __awaiter(this, void 0, void 0, function* () {
        const { cleanUrl, query, startOffset, pageNumber } = buildCleanSearchUrl(googleUrl);
        console.log(`Scraping Google Search Page ${pageNumber} (start=${startOffset}) for: "${query}"`);
        console.log(`Clean URL: ${cleanUrl}`);
        const isServer = !!process.env.PUPPETEER_EXECUTABLE_PATH;
        const hasDisplay = !!process.env.DISPLAY;
        const execPath = process.env.PUPPETEER_EXECUTABLE_PATH || undefined;
        const browser = yield puppeteer_extra_1.default.launch({
            // Use headless:false when a display is available (Xvfb on server, or real screen locally)
            // This makes Google think it's a real browser and avoids CAPTCHA
            headless: hasDisplay ? false : true,
            executablePath: execPath,
            userDataDir: isServer ? undefined : './user_data',
            args: [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-blink-features=AutomationControlled",
                "--disable-dev-shm-usage",
                "--disable-gpu",
                "--window-size=1280,900",
                '--lang=en-US,en'
            ],
        });
        try {
            const page = yield browser.newPage();
            yield page.setViewport({ width: 1280, height: 900 });
            yield page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");
            yield page.setExtraHTTPHeaders({
                "Accept-Language": "en-US,en;q=0.9",
                Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
                "Upgrade-Insecure-Requests": "1",
            });
            yield page.evaluateOnNewDocument(() => {
                delete navigator.__proto__.webdriver;
                Object.defineProperty(navigator, "webdriver", {
                    get: () => undefined,
                });
                Object.defineProperty(navigator, "languages", {
                    get: () => ["en-US", "en"],
                });
            });
            yield page.goto(cleanUrl, {
                waitUntil: "networkidle2",
                timeout: 60000,
            });
            // --- CAPTCHA-AWARE WAIT STRATEGY ---
            console.log("Waiting for page to load... If a CAPTCHA appears, please solve it in the browser window.");
            const MAX_WAIT_MS = 180000; // 3 minutes
            const POLL_INTERVAL_MS = 2000; // check every 2 seconds
            const startTime = Date.now();
            let captchaSolved = false;
            while (Date.now() - startTime < MAX_WAIT_MS) {
                let pageState = { hasCaptcha: false, hasResults: false };
                try {
                    pageState = yield page.evaluate(() => {
                        const hasCaptcha = !!document.getElementById('captcha-form') ||
                            !!document.querySelector('.g-recaptcha') ||
                            document.title.toLowerCase().includes('unusual traffic');
                        const hasResults = (document.body.innerText || "").length > 500 && !hasCaptcha;
                        return { hasCaptcha, hasResults };
                    });
                }
                catch (navErr) {
                    // Page is navigating (captcha was just solved), wait for it to settle
                    console.log("Page is navigating, waiting for new page to load...");
                    try {
                        yield page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 });
                    }
                    catch (e) { /* navigation might have already completed */ }
                    yield new Promise(resolve => setTimeout(resolve, 3000));
                    continue; // Re-evaluate page state in the next loop
                }
                if (pageState.hasCaptcha) {
                    const elapsed = Math.round((Date.now() - startTime) / 1000);
                    console.log(`[${elapsed}s] CAPTCHA detected - please solve it in the browser window...`);
                }
                else if (pageState.hasResults) {
                    console.log("Results page detected! Continuing scraping...");
                    captchaSolved = true;
                    break;
                }
                else {
                    console.log("Page loading or empty, waiting...");
                }
                yield new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
            }
            if (!captchaSolved) {
                throw new Error(`Scraping timed out after ${MAX_WAIT_MS / 1000}s. CAPTCHA was not solved or no results were found.`);
            }
            // --- END CAPTCHA STRATEGY ---
            // Extract the exact company names shown on this page
            const rawPlaces = yield page.evaluate(() => {
                const SKIP = [
                    "Choose what",
                    "Customised date",
                    "feedback",
                    "Map",
                    "Results",
                    "Sponsored",
                ];
                const items = [];
                const seen = new Set();
                // Each company heading in Google Search local pack has one of these obfuscated classes
                // We explicitly DO NOT use [role="heading"] because it matches organic blue links (SEO titles)
                const headingEls = Array.from(document.querySelectorAll('.qBF1Pd, .OSrC9, .v55F0e, .dbg0pd, .vwV14, .rnGtFd, .BNeawe'));
                for (const headingEl of headingEls) {
                    const name = headingEl.textContent
                        ? headingEl.textContent.trim()
                        : "";
                    if (!name ||
                        name.length < 3 ||
                        seen.has(name) ||
                        SKIP.some((s) => name.includes(s)))
                        continue;
                    // Check if this is a sponsored ad
                    let isSponsored = false;
                    let checkContainer = headingEl.parentElement;
                    for (let level = 0; level < 10 && checkContainer; level++) {
                        const text = checkContainer.textContent || "";
                        if (text.includes("Sponsored") || text.includes("Ad·") || checkContainer.closest('.uEierd') || checkContainer.closest('[data-text-ad]')) {
                            isSponsored = true;
                            break;
                        }
                        checkContainer = checkContainer.parentElement;
                    }
                    if (isSponsored)
                        continue;
                    // Walk UP the DOM to find the card container (has links, phone, rating)
                    let container = headingEl.parentElement;
                    let websiteUrl = "";
                    let phone = "";
                    let rating = "";
                    let address = "";
                    for (let level = 0; level < 10 && container; level++) {
                        const allLinks = Array.from(container.querySelectorAll("a[href]"));
                        // Find "Website" button link
                        if (!websiteUrl) {
                            for (const a of allLinks) {
                                const href = a.getAttribute("href") || "";
                                const ariaLabel = (a.getAttribute("aria-label") || "").toLowerCase();
                                const linkText = (a.textContent || "").trim().toLowerCase();
                                if (ariaLabel.includes("website") ||
                                    linkText === "website") {
                                    if (href.includes("/url?q=")) {
                                        const match = href.match(/\/url\?q=([^&]+)/);
                                        if (match && match[1]) {
                                            websiteUrl = decodeURIComponent(match[1]);
                                        }
                                    }
                                    else if (href.startsWith("http") &&
                                        !href.includes("google.com")) {
                                        websiteUrl = href;
                                    }
                                    break;
                                }
                            }
                        }
                        // Also find any external http link as fallback
                        if (!websiteUrl) {
                            for (const a of allLinks) {
                                const href = a.getAttribute("href") || "";
                                if (href.startsWith("http") &&
                                    !href.includes("google.com") &&
                                    !href.includes("goo.gl")) {
                                    websiteUrl = href;
                                    break;
                                }
                            }
                        }
                        // Phone
                        if (!phone) {
                            const text = container.textContent || "";
                            const pm = text.match(/(?:\+91[\s-]?)?\d{5}[\s-]?\d{5}|\b0\d{2,4}[-.\s]?\d{6,8}\b|\b\d{10}\b/);
                            if (pm)
                                phone = pm[0];
                        }
                        // Rating
                        if (!rating) {
                            const rEl = container.querySelector('[aria-label*="star" i], [aria-label*="Rated" i], .MW4wKf, .yi40Hd');
                            if (rEl) {
                                rating =
                                    rEl.getAttribute("aria-label") ||
                                        (rEl.textContent ? rEl.textContent.trim() : "");
                            }
                        }
                        // Stop early if we already have website (card found)
                        if (websiteUrl)
                            break;
                        container = container.parentElement;
                    }
                    seen.add(name);
                    items.push({ name, websiteUrl, phone, rating, address });
                }
                return items;
            });
            yield browser.close();
            console.log(`Extracted ${rawPlaces.length} exact companies from Google Search Page ${pageNumber}.`);
            return rawPlaces;
        }
        catch (error) {
            yield browser.close();
            throw error;
        }
    });
}
