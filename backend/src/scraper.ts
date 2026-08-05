import axios from "axios";
import * as cheerio from "cheerio";
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

export interface ScrapeResult {
  companyName: string;
  companyUrl: string;
  companyPhone: string;
  companyEmail: string;
  service: string;
  detectedServices: string[];
  technologies: string[];
  address?: string;
  rating?: string;
}

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_REGEX = /(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{2,4}\)?[-.\s]?)?\d{3,4}[-.\s]?\d{3,4}/g;

export function isGoogleSearchUrl(url: string): boolean {
  try {
    const u = url.trim().toLowerCase();
    return (
      u.includes("google.com/search") ||
      u.includes("google.co.in/search") ||
      u.includes("google.com/maps") ||
      u.includes("udm=1") ||
      u.includes("tbm=lcl")
    );
  } catch {
    return false;
  }
}

/**
 * Extract search query and start offset from any Google Search URL.
 * Returns a clean minimal search URL to avoid CAPTCHA blocks.
 */
export function buildCleanSearchUrl(originalUrl: string): {
  cleanUrl: string;
  query: string;
  startOffset: number;
  pageNumber: number;
} {
  let query = "it company";
  let startOffset = 0;

  try {
    const u = new URL(
      originalUrl.startsWith("http") ? originalUrl : `https://${originalUrl}`
    );

    // Extract query
    const q = u.searchParams.get("q");
    if (q && q.trim()) {
      query = q.trim();
    } else if (u.pathname.includes("/maps/search/")) {
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
  } catch {}

  const pageNumber = Math.floor(startOffset / 20) + 1;

  // Build a clean URL with only essential params — no tracking params that trigger CAPTCHA
  const cleanUrl =
    `https://www.google.com/search?q=${encodeURIComponent(query)}&udm=1&num=20&hl=en&gl=in` +
    (startOffset > 0 ? `&start=${startOffset}` : "");

  return { cleanUrl, query, startOffset, pageNumber };
}

function normalizeUrl(url: string): string {
  let u = url.trim();
  if (!/^https?:\/\//i.test(u)) {
    u = "https://" + u;
  }
  return u;
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

function cleanText(value: string | undefined): string {
  if (!value) return "";
  return value.replace(/\s+/g, " ").trim();
}

function detectServices(html: string, $: cheerio.CheerioAPI): string[] {
  const found = new Set<string>();

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

  const serviceMap: Array<[string, string[]]> = [
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

function detectTechnologies(html: string, $: cheerio.CheerioAPI): string[] {
  const found = new Set<string>();
  const lower = html.toLowerCase();

  const metaGenerator = $('meta[name="generator"]').attr("content");
  if (metaGenerator) {
    const gen = metaGenerator.toLowerCase();
    if (gen.includes("wordpress")) found.add("WordPress");
    if (gen.includes("joomla")) found.add("Joomla");
    if (gen.includes("drupal")) found.add("Drupal");
    if (gen.includes("wix")) found.add("Wix");
    if (gen.includes("squarespace")) found.add("Squarespace");
    if (gen.includes("shopify")) found.add("Shopify");
  }

  const techMap: Array<[string, string[]]> = [
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

export async function scrapeWebsite(url: string): Promise<ScrapeResult> {
  const fullUrl = normalizeUrl(url);
  const domain = getDomain(fullUrl);

  let html = "";
  let finalUrl = fullUrl;

  // --- Step 1: Try axios first ---
  try {
    const res = await axios.get(fullUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36",
      },
      timeout: 10000,
      maxRedirects: 5,
    });
    html = res.data;
    finalUrl = res.request?.res?.responseUrl || fullUrl;
  } catch (e) {
    // axios failed — will use puppeteer below
  }

  // --- Step 2: If axios got thin/empty content (JS-rendered site), use Puppeteer ---
  const tempText = html ? html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '';
  const isContentThin = tempText.length < 800;

  if (!html || isContentThin) {
    let browser: any;
    try {
      const websiteExecPath = process.env.PUPPETEER_EXECUTABLE_PATH || undefined;
      const hasDisplay = !!process.env.DISPLAY;
      browser = await puppeteer.launch({
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
      const page = await browser.newPage();
      await page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36"
      );
      await page.setViewport({ width: 1280, height: 900 });
      // Use networkidle2 to wait for JS-rendered content
      await page.goto(fullUrl, { waitUntil: "networkidle2", timeout: 20000 });
      // Extra wait for lazy-loaded sections
      await new Promise(resolve => setTimeout(resolve, 2000));
      // Scroll to trigger lazy loading
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
      await new Promise(resolve => setTimeout(resolve, 1000));
      html = await page.content();
      finalUrl = page.url();
      await browser.close();
    } catch (e2) {
      if (browser) { try { await browser.close(); } catch (_) {} }
      if (!html) throw new Error(`Could not fetch website ${fullUrl}`);
    }
  }

  // --- Step 3: Also fetch /services page for better service detection ---
  let servicesHtml = '';
  try {
    const baseOrigin = new URL(finalUrl).origin;
    const servicesUrl = `${baseOrigin}/services`;
    const svcRes = await axios.get(servicesUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36" },
      timeout: 6000,
      maxRedirects: 3,
    });
    if (svcRes.status === 200) servicesHtml = svcRes.data || '';
  } catch (_) { /* /services page not available */ }

  const $ = cheerio.load(html);

  let companyName =
    cleanText($('meta[property="og:site_name"]').attr("content")) ||
    cleanText($('meta[name="application-name"]').attr("content")) ||
    cleanText($("title").first().text()) ||
    cleanText($("h1").first().text()) ||
    domain;

  if (companyName) {
    const parts = companyName.split(/[-–—|]/)[0].trim();
    if (parts) companyName = parts;
  }

  const companyUrl = finalUrl || fullUrl;

  let email = "";
  const emails = new Set<string>();
  $('a[href^="mailto:"]').each((_, el) => {
    const href = $(el).attr("href") || "";
    const m = href.replace("mailto:", "").split("?")[0].trim();
    if (m && EMAIL_REGEX.test(m)) emails.add(m);
  });
  const emailMeta =
    cleanText($('meta[name="email"]').attr("content")) ||
    cleanText($('meta[name="contact"]').attr("content"));
  if (emailMeta && EMAIL_REGEX.test(emailMeta)) emails.add(emailMeta);
  const textMatches = html.match(EMAIL_REGEX) || [];
  textMatches.forEach((m) => {
    if (
      !m.includes("example.com") &&
      !m.includes(".png") &&
      !m.includes(".jpg")
    ) {
      emails.add(m.toLowerCase());
    }
  });
  email = Array.from(emails)[0] || "";

  let phone = "";
  const phones = new Set<string>();
  $('a[href^="tel:"]').each((_, el) => {
    const href = $(el).attr("href") || "";
    const num = href
      .replace("tel:", "")
      .split("?")[0]
      .replace(/[^\d+]/g, "")
      .trim();
    if (num) phones.add(num);
  });
  const phoneMeta =
    cleanText($('meta[name="phone"]').attr("content")) ||
    cleanText($('meta[name="telephone"]').attr("content"));
  if (phoneMeta) phones.add(phoneMeta.replace(/[^\d+]/g, ""));
  const bodyText = $("body").text();
  const phoneMatches = bodyText.match(PHONE_REGEX) || [];
  phoneMatches.forEach((p) => {
    const clean = p.replace(/[^\d+]/g, "");
    if (clean.length >= 7 && clean.length <= 15) phones.add(clean);
  });
  phone = Array.from(phones)[0] || "";

  let service =
    cleanText($('meta[name="description"]').attr("content")) ||
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
}

/**
 * Scrape EXACT companies from a Google Search URL (udm=1 places mode).
 * Builds a clean minimal URL from the query + pagination offset to avoid CAPTCHA.
 * Returns exactly the companies visible on that page in the browser.
 */
export async function scrapeGoogleSearchPlaces(
  googleUrl: string
): Promise<any[]> {
  const { cleanUrl, query, startOffset, pageNumber } =
    buildCleanSearchUrl(googleUrl);

  console.log(
    `Scraping Google Search Page ${pageNumber} (start=${startOffset}) for: "${query}"`
  );
  console.log(`Clean URL: ${cleanUrl}`);

  const isServer = !!process.env.PUPPETEER_EXECUTABLE_PATH;
  const hasDisplay = !!process.env.DISPLAY;
  const execPath = process.env.PUPPETEER_EXECUTABLE_PATH || undefined;
  const browser = await puppeteer.launch({
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
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    );
    await page.setExtraHTTPHeaders({
      "Accept-Language": "en-US,en;q=0.9",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      "Upgrade-Insecure-Requests": "1",
    });
    await page.evaluateOnNewDocument(() => {
      delete (navigator as any).__proto__.webdriver;
      Object.defineProperty(navigator, "webdriver", {
        get: () => undefined,
      });
      Object.defineProperty(navigator, "languages", {
        get: () => ["en-US", "en"],
      });
    });

    await page.goto(cleanUrl, {
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
            pageState = await page.evaluate(() => {
                const hasCaptcha = !!document.getElementById('captcha-form') || 
                                   !!document.querySelector('.g-recaptcha') ||
                                   document.title.toLowerCase().includes('unusual traffic');
                const hasResults = (document.body.innerText || "").length > 500 && !hasCaptcha;
                return { hasCaptcha, hasResults };
            });
        } catch (navErr) {
            // Page is navigating (captcha was just solved), wait for it to settle
            console.log("Page is navigating, waiting for new page to load...");
            try {
                await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 });
            } catch(e) { /* navigation might have already completed */ }
            await new Promise(resolve => setTimeout(resolve, 3000));
            continue; // Re-evaluate page state in the next loop
        }

        if (pageState.hasCaptcha) {
            const elapsed = Math.round((Date.now() - startTime) / 1000);
            console.log(`[${elapsed}s] CAPTCHA detected - please solve it in the browser window...`);
        } else if (pageState.hasResults) {
            console.log("Results page detected! Continuing scraping...");
            captchaSolved = true;
            break;
        } else {
            console.log("Page loading or empty, waiting...");
        }
        
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
    }

    if (!captchaSolved) {
        throw new Error(
            `Scraping timed out after ${MAX_WAIT_MS / 1000}s. CAPTCHA was not solved or no results were found.`
        );
    }
    // --- END CAPTCHA STRATEGY ---

    // Extract the exact company names shown on this page
    const rawPlaces = await page.evaluate(() => {
      const SKIP = [
        "Choose what",
        "Customised date",
        "feedback",
        "Map",
        "Results",
        "Sponsored",
      ];

      interface PlaceItem {
        name: string;
        websiteUrl: string;
        phone: string;
        rating: string;
        address: string;
      }

      const items: PlaceItem[] = [];
      const seen = new Set<string>();

      // Each company heading in Google Search local pack has one of these obfuscated classes
      // We explicitly DO NOT use [role="heading"] because it matches organic blue links (SEO titles)
      const headingEls = Array.from(
        document.querySelectorAll(
          '.qBF1Pd, .OSrC9, .v55F0e, .dbg0pd, .vwV14, .rnGtFd, .BNeawe'
        )
      );

      for (const headingEl of headingEls) {
        const name = headingEl.textContent
          ? headingEl.textContent.trim()
          : "";
        if (
          !name ||
          name.length < 3 ||
          seen.has(name) ||
          SKIP.some((s) => name.includes(s))
        )
          continue;

        // Check if this is a sponsored ad
        let isSponsored = false;
        let checkContainer: Element | null = headingEl.parentElement;
        for (let level = 0; level < 10 && checkContainer; level++) {
          const text = checkContainer.textContent || "";
          if (text.includes("Sponsored") || text.includes("Ad·") || checkContainer.closest('.uEierd') || checkContainer.closest('[data-text-ad]')) {
            isSponsored = true;
            break;
          }
          checkContainer = checkContainer.parentElement;
        }
        
        if (isSponsored) continue;

        // Walk UP the DOM to find the card container (has links, phone, rating)
        let container: Element | null = headingEl.parentElement;
        let websiteUrl = "";
        let phone = "";
        let rating = "";
        let address = "";

        for (let level = 0; level < 10 && container; level++) {
          const allLinks = Array.from(
            container.querySelectorAll("a[href]")
          );

          // Find "Website" button link
          if (!websiteUrl) {
            for (const a of allLinks) {
              const href = a.getAttribute("href") || "";
              const ariaLabel = (
                a.getAttribute("aria-label") || ""
              ).toLowerCase();
              const linkText = (a.textContent || "").trim().toLowerCase();

              if (
                ariaLabel.includes("website") ||
                linkText === "website"
              ) {
                if (href.includes("/url?q=")) {
                  const match = href.match(/\/url\?q=([^&]+)/);
                  if (match && match[1]) {
                    websiteUrl = decodeURIComponent(match[1]);
                  }
                } else if (
                  href.startsWith("http") &&
                  !href.includes("google.com")
                ) {
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
              if (
                href.startsWith("http") &&
                !href.includes("google.com") &&
                !href.includes("goo.gl")
              ) {
                websiteUrl = href;
                break;
              }
            }
          }

          // Phone
          if (!phone) {
            const text = container.textContent || "";
            const pm = text.match(
              /(?:\+91[\s-]?)?\d{5}[\s-]?\d{5}|\b0\d{2,4}[-.\s]?\d{6,8}\b|\b\d{10}\b/
            );
            if (pm) phone = pm[0];
          }

          // Rating
          if (!rating) {
            const rEl = container.querySelector(
              '[aria-label*="star" i], [aria-label*="Rated" i], .MW4wKf, .yi40Hd'
            );
            if (rEl) {
              rating =
                rEl.getAttribute("aria-label") ||
                (rEl.textContent ? rEl.textContent.trim() : "");
            }
          }

          // Stop early if we already have website (card found)
          if (websiteUrl) break;
          container = container.parentElement;
        }

        seen.add(name);
        items.push({ name, websiteUrl, phone, rating, address });
      }

      return items;
    });

    await browser.close();

    console.log(
      `Extracted ${rawPlaces.length} exact companies from Google Search Page ${pageNumber}.`
    );

    return rawPlaces;
  } catch (error) {
    await browser.close();
    throw error;
  }
}