// --- 0. Initialization & UI Logic ---
let jsPDF;
try {
    if (window.jspdf && window.jspdf.jsPDF) {
        jsPDF = window.jspdf.jsPDF;
    }
} catch (e) {
    console.error("Initialization Error:", e);
}

function setStatus(id, text) {
    const el = document.getElementById(id);
    if (el) el.innerText = text;
}

// Mobile Menu Toggle Logic
document.addEventListener('DOMContentLoaded', () => {
    const menuToggle = document.getElementById('menuToggle');
    const navLinks = document.getElementById('navLinks');

    if (menuToggle && navLinks) {
        menuToggle.addEventListener('click', () => {
            navLinks.classList.toggle('active');
            menuToggle.classList.toggle('active');
        });

        // Close menu when clicking a link
        navLinks.querySelectorAll('.s-nav-item').forEach(link => {
            link.addEventListener('click', () => {
                navLinks.classList.remove('active');
                menuToggle.classList.remove('active');
            });
        });
    }
});

// --- 1. File Converters Logic ---
function setupConverters() {
    console.log("Setting up converters...");
    const saferAddListener = (id, event, handler) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener(event, handler);
        else console.warn(`Element #${id} not found for ${event} listener.`);
    };

    // PNG to JPG
    saferAddListener('pngInput', 'change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setStatus('pngStatus', '⏳ Converting...');
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = "white"; // Background for transparency
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0);
                const link = document.createElement('a');
                link.href = canvas.toDataURL('image/jpeg', 0.9);
                link.download = `${file.name.split('.')[0]}.jpg`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                setStatus('pngStatus', '✅ Converted!');
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    });

    // JPG to PDF
    saferAddListener('jpgInput', 'change', async (e) => {
        try {
            const file = e.target.files[0];
            if (!file) return;

            const quality = document.getElementById('jpgQuality').value / 100;
            setStatus('jpgStatus', `⏳ Processing (Qual: ${Math.round(quality*100)}%)...`);
            
            if (!jsPDF) throw new Error("PDF Library not loaded.");

            const reader = new FileReader();
            reader.onload = function(event) {
                const img = new Image();
                img.onload = function() {
                    try {
                        const canvas = document.createElement('canvas');
                        const ctx = canvas.getContext('2d');
                        canvas.width = img.width;
                        canvas.height = img.height;
                        ctx.drawImage(img, 0, 0);
                        
                        const dataUrl = canvas.toDataURL('image/jpeg', quality);
                        
                        // --- FIX: Match PDF size exactly to image size (no white borders) ---
                        // jsPDF(orientation, unit, format)
                        // orientation: 'p' or 'l', unit: 'px', format: [width, height]
                        const orientation = img.width > img.height ? 'l' : 'p';
                        const pdf = new jsPDF(orientation, 'px', [img.width, img.height]);
                        
                        pdf.addImage(dataUrl, 'JPEG', 0, 0, img.width, img.height);
                        pdf.save(`${file.name.split('.')[0]}.pdf`);
                        setStatus('jpgStatus', '✅ Downloaded!');
                    } catch (innerErr) {
                        alert(`Add Image Error: ${innerErr.message}`);
                        setStatus('jpgStatus', '❌ Failed');
                    }
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        } catch (err) {
            alert(`Error: ${err.message}`);
            setStatus('jpgStatus', '❌ Error');
        }
    });

    // --- 2. Word to PDF (FIXED: Arabic/Urdu Support & Blank Page Fix) ---
    saferAddListener('wordInput', 'change', async (e) => {
        try {
            const file = e.target.files[0];
            if (!file) return;

            setStatus('wordStatus', '⏳ Reading Word Document...');
            if (typeof mammoth === 'undefined') throw new Error("Mammoth library not loaded.");
            if (typeof html2pdf === 'undefined') throw new Error("PDF Library error.");

            const reader = new FileReader();
            reader.onload = async function(ev) {
                try {
                    const result = await mammoth.convertToHtml({arrayBuffer: ev.target.result});
                    const html = result.value; 
                    if (!html || html.trim() === "") {
                        throw new Error("The Word document appears to be empty or unreadable.");
                    }
                    setStatus('wordStatus', '⏳ Loading Fonts...');

                    const isUrdu = /[\u067E\u0686\u0691\u06A9\u06AF\u06BA\u06BE\u06C1\u06D2]/.test(html);
                    const isArabic = /[\u0621-\u064A]/.test(html);
                    const isRTL = isUrdu || isArabic;
                    
                    const fontToLoad = isUrdu ? '12pt "Noto Nastaliq Urdu"' : (isArabic ? '12pt "Noto Naskh Arabic"' : '12pt "Arial"');
                    
                    try {
                        await document.fonts.load(fontToLoad);
                    } catch (fErr) { console.warn("Font pre-load warning:", fErr); }

                    const renderContainer = document.getElementById('word-pdf-render');
                    
                    // 2. APPLY WORD-PERFECT A4 STYLING
                    renderContainer.className = `word-perfect-page ${isRTL ? 'word-rtl' : 'word-ltr'}`;
                    renderContainer.style.position = "fixed";
                    renderContainer.style.top = "0";
                    renderContainer.style.left = "0";
                    renderContainer.style.display = "block";
                    renderContainer.style.visibility = "visible";
                    renderContainer.style.zIndex = "10000"; 
                    
                    // Add a tiny delay to ensure class styles are applied before innerHTML
                    renderContainer.innerHTML = html;
                    
                    setStatus('wordStatus', '⏳ Generating PDF (Don\'t scroll)...');

                    // Final Robost Manual Capture Logic
                    setTimeout(async () => {
                        try {
                            const isLocal = window.location.protocol === 'file:';
                            
                            // 3. Scroll to the top briefly to ensure capture doesn't miss anything
                            const oldScroll = window.scrollY;
                            window.scrollTo(0, 0);

                            const canvas = await html2canvas(renderContainer, {
                                scale: 3, // HD Resolution Boost
                                useCORS: !isLocal,
                                allowTaint: isLocal,
                                backgroundColor: "#ffffff",
                                logging: false,
                                letterRendering: true,
                                scrollX: 0,
                                scrollY: 0,
                                x: 0,
                                y: 0,
                                width: renderContainer.offsetWidth,
                                height: renderContainer.offsetHeight
                            });

                            // Restore scroll
                            window.scrollTo(0, oldScroll);

                            const imgData = canvas.toDataURL('image/jpeg', 1.0);
                            
                            // Check if image data is valid and not a tiny white pixel
                            if (imgData.length < 500) {
                                throw new Error("Captured image appears blank. Please check the content.");
                            }

                            // 4. Manual jsPDF Generation
                            const pdf = new jsPDF('p', 'pt', 'a4');
                            const pdfWidth = pdf.internal.pageSize.getWidth();
                            const pdfHeight = pdf.internal.pageSize.getHeight();
                            
                            // Scale image to fit A4 width
                            const imgWidth = canvas.width;
                            const imgHeight = canvas.height;
                            const ratio = Math.min(pdfWidth / imgWidth, (pdfHeight - 80) / imgHeight);
                            const finalWidth = imgWidth * ratio;
                            const finalHeight = imgHeight * ratio;

                            pdf.addImage(imgData, 'JPEG', (pdfWidth - finalWidth) / 2, 40, finalWidth, finalHeight);
                            pdf.save(file.name.replace(".docx", ".pdf"));
                            
                            // Cleanup
                            renderContainer.style.display = "none";
                            renderContainer.innerHTML = "";
                            setStatus('wordStatus', '✅ PDF Downloaded!');
                        } catch (pdfErr) {
                            console.error("Manual PDF Error:", pdfErr);
                            setStatus('wordStatus', '❌ Capture Failed: ' + pdfErr.message);
                            renderContainer.style.display = "none";
                        }
                    }, 1800); 


                } catch (procErr) {
                    alert(`Error: ${procErr.message}`);
                    setStatus('wordStatus', '❌ Error');
                }
            };
            reader.readAsArrayBuffer(file);
        } catch (err) {
            alert(`Error: ${err.message}`);
            setStatus('wordStatus', '❌ Failed');
        }
    });
}

// --- 7. Unit Converter ---
function convertUnit() {
    const val = parseFloat(document.getElementById('unitVal').value);
    const type = document.getElementById('unitType').value;
    const res = document.getElementById('unitResult');
    let output = "";

    if (isNaN(val)) return alert("Please enter a valid number");

    if (type === "ft2m") output = (val * 0.3048).toFixed(2) + " Meters";
    else if (type === "m2ft") output = (val * 3.28084).toFixed(2) + " Feet";
    else if (type === "kg2lb") output = (val * 2.20462).toFixed(2) + " Lbs";
    else if (type === "lb2kg") output = (val * 0.453592).toFixed(2) + " KG";

    res.innerText = output;
    setStatus('unitStatus', '✅ Converted!');
}

// --- 9. YouTube Compact Link Box (FINAL FIX) ---
function loadYTVideo() {
    const urlInput = document.getElementById('ytLink');
    const url = urlInput.value.trim();
    const cinema = document.getElementById('cinema');
    const downloadBtn = document.getElementById('ytDownloadLink');
    const watchOnYT = document.getElementById('watchOnYT');
    
    if (!url) return alert("Please paste a YouTube link!");

    // Universal YouTube Regex
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=|shorts\/)|youtu\.be\/)([^"&?\/\s]{11})/i;
    const match = url.match(regex);
    const videoId = match ? match[1] : null;

    if (!videoId) {
        setStatus('ytStatus', '❌ Invalid YouTube URL');
        return alert("Invalid YouTube URL.");
    }

    // UPDATE LINKS & SHOW BOX
    downloadBtn.href = `https://en.savefrom.net/7/?url=${encodeURIComponent(url)}`;
    watchOnYT.href = url;

    // Persist URL
    localStorage.setItem('pakportal_yt_url', url);

    // Show Compact Box
    cinema.style.display = "block";
    cinema.scrollIntoView({behavior: "smooth"});
    setStatus('ytStatus', '✅ Downloader Ready!');
}

function closeCinema() {
    document.getElementById('cinema').style.display = "none";
    document.getElementById('ytPlayerContainer').innerHTML = "";
    setStatus('ytStatus', '');
}

// --- Digital Gadgets Logic (Header Phase 4) ---

function updateClock() {
    const clocks = document.querySelectorAll('.st-clock');
    const dates = document.querySelectorAll('.st-date');
    if (clocks.length === 0) return;
    
    const now = new Date();
    const pakTime = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Karachi',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
    }).format(now).toUpperCase();
    
    const pakDate = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Karachi',
        day: '2-digit', month: 'short', year: 'numeric'
    }).format(now).toUpperCase();

    clocks.forEach(el => el.innerText = pakTime);
    dates.forEach(el => el.innerText = pakDate);
}

async function fetchWeather(city = "Lahore") {
    const temps = document.querySelectorAll('.st-temp');
    const cities = document.querySelectorAll('.st-city');
    const icons = document.querySelectorAll('.st-icon');
    
    try {
        const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`);
        const geoData = await geoRes.json();
        if (!geoData.results) return;
        
        const { latitude, longitude, name } = geoData.results[0];
        const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`);
        const weatherData = await weatherRes.json();
        
        const tempVal = `${Math.round(weatherData.current_weather.temperature)}°C`;
        const weatherIcons = { 0: "☀️", 1: "🌤️", 2: "⛅", 3: "☁️", 45: "🌫️", 51: "🌦️", 61: "🌧️", 71: "❄️", 95: "⛈️" };
        const iconVal = weatherIcons[weatherData.current_weather.weathercode] || "🌤️";

        temps.forEach(el => el.innerText = tempVal);
        cities.forEach(el => {
            el.innerText = name;
            el.style.display = 'inline-block'; // Ensure visibility
        });
        icons.forEach(el => el.innerText = iconVal);
    } catch (err) { console.error(err); }
}

// Global City Autocomplete Logic
function toggleWeatherSearch() {
    const dropdown = document.getElementById('weather-search-dropdown');
    dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
    if (dropdown.style.display === 'block') document.getElementById('city-autocomplete').focus();
}

// Global Search Event
function setupSearch() {
    const searchInput = document.getElementById('city-autocomplete');
    if (searchInput) {
        searchInput.addEventListener('input', async (e) => {
            const query = e.target.value.trim();
            if (query.length < 2) return;
            try {
                const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5`);
                const data = await res.json();
                const resultsBox = document.getElementById('search-results');
                resultsBox.innerHTML = "";
                (data.results || []).forEach(city => {
                    const div = document.createElement('div');
                    div.className = 'search-item';
                    div.innerText = `${city.name}, ${city.country || ""}`;
                    div.onclick = () => {
                        fetchWeather(city.name);
                        updatePrayerTimes(city.name);
                        document.getElementById('weather-search-dropdown').style.display = 'none';
                        document.getElementById('city-autocomplete').value = "";
                    };
                    resultsBox.appendChild(div);
                });
            } catch (err) { console.error(err); }
        });
    }

    // Close search if clicking outside
    document.addEventListener('click', (e) => {
        const dropdown = document.getElementById('weather-search-dropdown');
        const box = dropdown ? dropdown.parentElement : null;
        if (dropdown && box && !box.contains(e.target)) dropdown.style.display = 'none';
    });
}


// --- 4. Photo Resize Tool ---
function setupResizeTool() {
    const input = document.getElementById('resizeInput');
    const width = document.getElementById('resizeWidth');
    if (input) input.addEventListener('change', handleResize);
    if (width) width.addEventListener('change', handleResize);
}

function handleResize() {
    try {
        const file = document.getElementById('resizeInput').files[0];
        if (!file) return;

        const targetWidth = parseInt(document.getElementById('resizeWidth').value);
        setStatus('resizeStatus', `⏳ Resizing...`);
        
        const reader = new FileReader();
        reader.onload = function(event) {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                const scale = targetWidth / img.width;
                canvas.width = targetWidth;
                canvas.height = img.height * scale;
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                
                const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
                const link = document.createElement('a');
                link.href = dataUrl;
                link.download = `resized-${file.name}`;
                link.click();
                setStatus('resizeStatus', '✅ Done!');
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    } catch (err) { console.error(err); }
}

// --- Premium Feature: QR Generator ---
function generateQR() {
    const text = document.getElementById('qrText').value;
    if (!text) {
        setStatus('qrStatus', '❌ Enter text first');
        return;
    }
    setStatus('qrStatus', '⏳ Generating...');
    
    // Using a reliable public QR API
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(text)}`;
    
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = function() {
        const link = document.createElement('a');
        link.href = qrUrl;
        link.download = "pakportal-qr.png";
        // Need to fetch and convert to blob for real download in some browsers
        fetch(qrUrl).then(res => res.blob()).then(blob => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = "qr-code.png";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setStatus('qrStatus', '✅ Downloaded!');
        });
    };
    img.src = qrUrl;
}

// --- Premium Feature: Global Currency Converter ---
async function convertCurrency() {
    const amount = document.getElementById('currAmount').value;
    const from = document.getElementById('currFrom').value;
    const to = document.getElementById('currTo').value;
    const resultEl = document.getElementById('currResult');
    
    resultEl.innerText = "⏳ Fetching...";
    
    try {
        const res = await fetch('https://open.er-api.com/v6/latest/USD');
        const data = await res.json();
        
        const fromBase = data.rates[from];
        const toBase = data.rates[to];
        
        const rate = toBase / fromBase;
        const total = (amount * rate).toFixed(2);
        
        resultEl.innerText = `${total} ${to}`;
    } catch (err) {
        resultEl.innerText = "❌ Error fetching rate";
    }
}

// AI Photo Editor - Real-time updates for sliders
let editorImg = new Image();

function setupPhotoEditor() {
    const filters = ['bright', 'contrast', 'saturate', 'hue', 'grayscale', 'sepia', 'blur'];
    filters.forEach(f => {
        const el = document.getElementById(f);
        if (el) el.addEventListener('input', applyFilters);
    });

    const input = document.getElementById('editorInput');
    if (input) {
        input.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (event) => {
                editorImg.onload = () => {
                    const canvas = document.getElementById('editorCanvas');
                    const placeholder = document.getElementById('editorPlaceholder');
                    canvas.style.display = "block";
                    placeholder.style.display = "none";
                    applyFilters();
                };
                editorImg.src = event.target.result;
            };
            reader.readAsDataURL(file);
        });
    }
}

function applyFilters() {
    if (!editorImg.src) return;
    const canvas = document.getElementById('editorCanvas');
    const ctx = canvas.getContext('2d');
    
    const b = document.getElementById('bright').value;
    const c = document.getElementById('contrast').value;
    const s = document.getElementById('saturate').value;
    const h = document.getElementById('hue').value;
    const g = document.getElementById('grayscale').value;
    const sep = document.getElementById('sepia').value;
    const bl = document.getElementById('blur').value;
    
    const maxWidth = 500; // Small resolution for "window" feel
    const scale = Math.min(1, maxWidth / editorImg.width);
    canvas.width = editorImg.width * scale;
    canvas.height = editorImg.height * scale;
    
    ctx.filter = `brightness(${b}%) contrast(${c}%) saturate(${s}%) hue-rotate(${h}deg) grayscale(${g}%) sepia(${sep}%) blur(${bl}px)`;
    ctx.drawImage(editorImg, 0, 0, canvas.width, canvas.height);
}

function downloadEdit() {
    if (!editorImg.src) return;
    const dlCanvas = document.createElement('canvas');
    const dlCtx = dlCanvas.getContext('2d');
    dlCanvas.width = editorImg.width;
    dlCanvas.height = editorImg.height;
    
    const b = document.getElementById('bright').value;
    const c = document.getElementById('contrast').value;
    const s = document.getElementById('saturate').value;
    const h = document.getElementById('hue').value;
    const g = document.getElementById('grayscale').value;
    const sep = document.getElementById('sepia').value;
    const bl = document.getElementById('blur').value;

    dlCtx.filter = `brightness(${b}%) contrast(${c}%) saturate(${s}%) hue-rotate(${h}deg) grayscale(${g}%) sepia(${sep}%) blur(${bl}px)`;
    dlCtx.drawImage(editorImg, 0, 0);
    
    const link = document.createElement('a');
    link.href = dlCanvas.toDataURL('image/jpeg', 0.95);
    link.download = "premium-edited.jpg";
    link.click();

    // Auto-clear after download
    setTimeout(() => {
        const canvas = document.getElementById('editorCanvas');
        const placeholder = document.getElementById('editorPlaceholder');
        canvas.style.display = "none";
        placeholder.style.display = "block";
        editorImg = new Image(); // Reset image object
    }, 500);
}

// --- 5. PDF Merger (Replaced Resize) ---
function setupPdfMerge() {
    const input = document.getElementById('pdfMergeInput');
    if (input) {
        input.addEventListener('change', async (e) => {
            try {
                const files = Array.from(e.target.files);
                if (files.length === 0) return;
                
                setStatus('pdfMergeStatus', '⏳ Merging PDFs...');
                if (typeof PDFLib === 'undefined') throw new Error("PDF-Lib not loaded.");
                
                const mergedPdf = await PDFLib.PDFDocument.create();
                
                for (let file of files) {
                    const arrayBuffer = await file.arrayBuffer();
                    const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);
                    const copiedPages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());
                    copiedPages.forEach((page) => mergedPdf.addPage(page));
                }
                
                const pdfBytes = await mergedPdf.save();
                const blob = new Blob([pdfBytes], { type: "application/pdf" });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = `Merged_${files.length}_Files.pdf`;
                link.click();
                
                setStatus('pdfMergeStatus', '✅ Merged & Downloaded!');
            } catch (err) {
                alert(`Merge Error: ${err.message}`);
                setStatus('pdfMergeStatus', '❌ Error');
            }
        });
    }
}


// --- 7. Back to Top Logic ---
function setupBackToTop() {
    const btt = document.getElementById('backToTop');
    if (btt) {
        window.onscroll = function() {
            if (document.body.scrollTop > 500 || document.documentElement.scrollTop > 500) {
                btt.style.display = "flex";
            } else {
                btt.style.display = "none";
            }
        };
        btt.onclick = function() {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        };
    }
}

// --- Smart Utilities Gadget Logic ---

// 1. Digital Tasbeeh
function incrementTasbeeh() {
    const el = document.getElementById('tasbeehCount');
    let count = parseInt(el.innerText);
    el.innerText = ++count;
    // Subtle haptic feel if supported
    if (window.navigator.vibrate) window.navigator.vibrate(20);
}

function resetTasbeeh() {
    if (confirm("Reset Tasbeeh count?")) {
        document.getElementById('tasbeehCount').innerText = 0;
    }
}

// --- Prayer Search & Autocomplete Logic ---
let prayerDebounceTimer;
async function searchPrayerCities(query) {
    const resultsContainer = document.getElementById('prayer-search-results');
    if (!query || query.length < 2) {
        resultsContainer.style.display = 'none';
        return;
    }

    clearTimeout(prayerDebounceTimer);
    prayerDebounceTimer = setTimeout(async () => {
        try {
            const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`);
            const data = await res.json();
            
            if (data.results && data.results.length > 0) {
                displayPrayerSuggestions(data.results);
            } else {
                resultsContainer.style.display = 'none';
            }
        } catch (e) {
            console.error("Geo Search Error:", e);
        }
    }, 400);
}

function displayPrayerSuggestions(results) {
    const container = document.getElementById('prayer-search-results');
    container.innerHTML = results.map(city => `
        <div onclick="selectPrayerCity('${city.name.replace(/'/g, "\\'")}', '${(city.country || '').replace(/'/g, "\\'")}')" 
             style="padding: 12px 15px; cursor: pointer; border-bottom: 1px solid rgba(0,0,0,0.05); font-size: 0.9rem; color: #333; transition: 0.2s;"
             onmouseover="this.style.background='rgba(166,124,82,0.1)'"
             onmouseout="this.style.background='#fff'">
            <strong>${city.name}</strong>, <span style="opacity: 0.7;">${city.country || ''}</span>
        </div>
    `).join('');
    container.style.display = 'block';
}

function selectPrayerCity(name, country) {
    const fullAddress = country ? `${name}, ${country}` : name;
    document.getElementById('prayerCitySearch').value = fullAddress;
    document.getElementById('prayer-search-results').style.display = 'none';
    updatePrayerTimes(fullAddress, false);
}

// 2. Global Prayer Times (Real-Time API Expansion)
async function updatePrayerTimes(query = "Lahore", isSearching = false) {
    const cityDisplay = document.getElementById('prayer-city-display');
    if (!query) return;

    if (!isSearching && cityDisplay) cityDisplay.innerText = query.toUpperCase();

    try {
        const timestamp = new Date().getTime();
        const res = await fetch(`https://api.aladhan.com/v1/timingsByAddress?address=${encodeURIComponent(query)}&method=2&_t=${timestamp}`);
        const data = await res.json();
        if (data.code !== 200) throw new Error("Location not found");
        
        const timings = data.data.timings;
        document.getElementById('fajr').innerText = timings.Fajr;
        document.getElementById('dhuhr').innerText = timings.Dhuhr;
        document.getElementById('asr').innerText = timings.Asr;
        document.getElementById('maghrib').innerText = timings.Maghrib;
        document.getElementById('isha').innerText = timings.Isha;
        
        document.getElementById('prayerTimes').style.animation = 'none';
        setTimeout(() => { document.getElementById('prayerTimes').style.animation = 'glow-pulse 1s ease'; }, 10);
    } catch (err) {
        if (cityDisplay) cityDisplay.innerText = "NOT FOUND";
    }
}

// 5. Urdu Voice-to-Text (Premium Overhaul)
let recognition;
let isListening = false;
let baseText = ""; 

function startVoiceRecognition() {
    const btn = document.getElementById('voiceBtn');
    const result = document.getElementById('urduTextResult');
    const status = document.getElementById('voiceStatus');
    const wave = document.getElementById('voiceWave');

    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        status.innerText = "❌ NOT SUPPORTED";
        return alert("Speech Recognition not supported in this browser.");
    }

    if (isListening) {
        stopVoiceRecognition();
        return;
    }

    // Capture the state BEFORE starting
    baseText = result.value.trim();
    if (baseText) baseText += " "; 
    
    isListening = true;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.lang = 'ur-PK';
    
    // KEY CHANGE FOR MOBILE: Use continuous = false for better stability
    // We handle "continuity" ourselves via onend restarts.
    recognition.continuous = false; 
    recognition.interimResults = true;

    recognition.onstart = () => {
        btn.innerHTML = 'STOP RECORDING';
        if (wave) wave.style.display = "flex";
        status.innerText = "• LISTENING •";
        status.style.color = "#ff4444";
        result.style.borderColor = "var(--accent-gold)";
    };

    recognition.onresult = (event) => {
        let interimTranscript = "";
        let sessionFinal = "";

        // Build current session results from index 0 every time to ensure no duplication
        for (let i = 0; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                // If its final, we add it to the final pool
                sessionFinal += transcript + " ";
            } else {
                interimTranscript += transcript;
            }
        }
        
        result.value = baseText + sessionFinal + interimTranscript;
        result.scrollTop = result.scrollHeight;
    };

    recognition.onerror = (event) => {
        if (event.error !== 'no-speech') {
            console.error("Speech Error:", event.error);
            status.innerText = `ERROR: ${event.error.toUpperCase()}`;
            // For severe errors, stop completely
            if (event.error === 'network' || event.error === 'not-allowed') {
                stopVoiceRecognition();
            }
        }
    };

    recognition.onend = () => {
        // If the user hasn't clicked STOP, we restart for "fake" continuous mode
        if (isListening) {
            // Update baseText to include whatever was finalized in the last session
            baseText = result.value.trim();
            if (baseText) baseText += " ";
            
            try {
                recognition.start();
            } catch(e) {
                console.warn("Restart failed, trying again...");
                setTimeout(() => { if(isListening) recognition.start(); }, 300);
            }
        } else {
            status.innerText = "READY TO RECORD";
            status.style.color = "var(--accent-gold)";
        }
    };

    try {
        recognition.start();
    } catch (e) {
        console.error(e);
        isListening = false;
        stopVoiceRecognition();
    }
}

function stopVoiceRecognition() {
    isListening = false;
    const btn = document.getElementById('voiceBtn');
    const status = document.getElementById('voiceStatus');
    const wave = document.getElementById('voiceWave');
    const result = document.getElementById('urduTextResult');

    if (recognition) {
        recognition.onend = null; // Prevent loop
        try { recognition.stop(); } catch(e) {}
    }
    
    if (btn) btn.innerHTML = 'START RECORDING';
    if (wave) wave.style.display = "none";
    if (status) {
        status.innerText = "READY TO RECORD";
        status.style.color = "var(--accent-gold)";
    }
    if (result) {
        result.style.borderColor = "rgba(255,193,7,0.3)";
        result.value = result.value.trim();
    }
}

function copyUrduText() {
    const text = document.getElementById('urduTextResult');
    text.select();
    document.execCommand('copy');
    alert("Urdu text copied!");
}

// 6. World Live Hub
async function refreshLiveHub() {
    console.log("Syncing World Hub...");
    const newsTicker = document.getElementById('news-ticker');
    const currencyGrid = document.getElementById('currency-grid');

    // 1. URDU NEWS (BBC Urdu via RSS2JSON)
    try {
        const res = await fetch('https://api.rss2json.com/v1/api.json?rss_url=https://feeds.bbci.co.uk/urdu/rss.xml');
        const data = await res.json();
        if (data.items) {
            newsTicker.innerHTML = data.items.slice(0, 8).map(item => `
                <div style="font-family: 'Noto Nastaliq Urdu', serif; font-size: 1rem; line-height: 2.2; color: var(--text-brown); margin-bottom: 20px; border-bottom: 1px solid rgba(166, 124, 82, 0.15); padding-bottom: 15px; direction: rtl; text-align: right;">
                    📢 ${item.title} <br>
                    <a href="${item.link}" target="_blank" style="color: var(--accent-gold); text-decoration: none; font-size: 0.8rem; font-weight: 800; font-family: 'Poppins', sans-serif;">[مزید پڑھیں]</a>
                </div>
            `).join('');
        }
    } catch(e) { newsTicker.innerText = "News Feed Error."; }

    // 2. WORLD CURRENCY Grid (Value of 1 Foreign Unit in PKR)
    try {
        const cRes = await fetch('https://open.er-api.com/v6/latest/PKR');
        const cData = await cRes.json();
        
        const currencies = [
            { code: 'USD', name: 'US Dollar', icon: '🇺🇸' },
            { code: 'EUR', name: 'Euro', icon: '🇪🇺' },
            { code: 'GBP', name: 'UK Pound', icon: '🇬🇧' },
            { code: 'SAR', name: 'Saudi Riyal', icon: '🇸🇦' },
            { code: 'AED', name: 'UAE Dirham', icon: '🇦🇪' },
            { code: 'CAD', name: 'Canadian Dollar', icon: '🇨🇦' },
            { code: 'OMR', name: 'Omani Rial', icon: '🇴🇲' },
            { code: 'KWD', name: 'Kuwaiti Dinar', icon: '🇰🇼' },
            { code: 'CNY', name: 'Chinese Yuan', icon: '🇨🇳' },
            { code: 'INR', name: 'Indian Rupee', icon: '🇮🇳' }
        ];

        currencyGrid.innerHTML = currencies.map(curr => {
            const rateToPkr = 1 / cData.rates[curr.code];
            return `
                <div style="background: rgba(166, 124, 82, 0.05); border: 1px solid rgba(166, 124, 82, 0.15); border-radius: 15px; padding: 15px; text-align: center; color: var(--text-brown);">
                    <div style="font-size: 1.4rem; margin-bottom: 8px;">${curr.icon}</div>
                    <div style="font-size: 0.7rem; font-weight: 800; opacity: 0.7; text-transform: uppercase;">1 ${curr.code} TO PKR</div>
                    <div style="font-size: 1.1rem; font-weight: 900; color: var(--text-brown); margin-top: 5px;">${rateToPkr.toFixed(2)}</div>
                </div>
            `;
        }).join('');
    } catch(e) { currencyGrid.innerText = "Market Sync Error."; }
}




// --- PRODUCTIVITY HUB LOGIC ---

// 1. Pomodoro Timer
let pomoInterval = null;
let pomoTime = 25 * 60; // 25 minutes
let pomoActive = false;

function formatPomoTime(secs) {
    let m = Math.floor(secs / 60).toString().padStart(2, '0');
    let s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

function startPomodoro() {
    let btn = document.getElementById('pomo-start-btn');
    let display = document.getElementById('pomodoro-time');
    
    if(pomoActive) {
        clearInterval(pomoInterval);
        pomoActive = false;
        btn.innerText = "RESUME";
        display.classList.remove('pulse-anim-on');
        display.classList.add('pulse-anim-off');
        return;
    }
    
    pomoActive = true;
    btn.innerText = "PAUSE";
    display.classList.remove('pulse-anim-off');
    display.classList.add('pulse-anim-on');
    
    pomoInterval = setInterval(() => {
        if(pomoTime > 0) {
            pomoTime--;
            display.innerText = formatPomoTime(pomoTime);
        } else {
            resetPomodoro();
            alert("Focus session complete! 🎉 Take a 5 minute break.");
        }
    }, 1000);
}

function resetPomodoro() {
    clearInterval(pomoInterval);
    pomoActive = false;
    pomoTime = 25 * 60;
    document.getElementById('pomo-start-btn').innerText = "START FOCUS";
    let display = document.getElementById('pomodoro-time');
    display.classList.remove('pulse-anim-on');
    display.classList.add('pulse-anim-off');
    display.innerText = "25:00";
}

// 2. Expense Tracker
let expensesData = [];
function initExpenses() {
    let saved = localStorage.getItem('pakportal_expenses');
    if(saved) {
        expensesData = JSON.parse(saved);
        renderExpenses();
    }
}

function renderExpenses() {
    const listEl = document.getElementById('expense-list');
    if(!listEl) return;
    listEl.innerHTML = '';
    let total = 0;
    expensesData.forEach((exp, idx) => {
        total += Number(exp.amount);
        listEl.innerHTML += `
            <div class="expense-row">
                <span style="flex: 2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-right: 5px; color: var(--text-brown);">${exp.desc}</span>
                <span class="urdu-text" style="flex: 1; text-align: right; color: rgba(166,124,82,1); font-weight: 800; font-family: 'Roboto Mono', monospace;">Rs ${exp.amount}</span>
                <button class="exp-del-btn" onclick="deleteExpense(${idx})" style="flex: 0; margin-left: 10px; border-left: 1px solid rgba(0,0,0,0.1); padding-left: 10px;">×</button>
            </div>
        `;
    });
    document.getElementById('expense-total').innerText = "Rs " + total.toLocaleString();
}

function addExpense() {
    let desc = document.getElementById('exp-desc').value.trim();
    let amt = document.getElementById('exp-amount').value.trim();
    if(!desc || !amt || isNaN(amt) || Number(amt) <= 0) return alert("Please enter valid positive number for amount and a description.");
    
    expensesData.push({desc: desc, amount: amt});
    localStorage.setItem('pakportal_expenses', JSON.stringify(expensesData));
    document.getElementById('exp-desc').value = '';
    document.getElementById('exp-amount').value = '';
    renderExpenses();
}

function deleteExpense(idx) {
    expensesData.splice(idx, 1);
    localStorage.setItem('pakportal_expenses', JSON.stringify(expensesData));
    renderExpenses();
}

// 3. Digital Journal & Mood Tracker
let journalLines = [];

function loadJournal() {
    let savedMood = localStorage.getItem('pakportal_mood') || '😊';
    setMood(savedMood, false);
    
    let saved = localStorage.getItem('pakportal_journal_lines');
    if(saved) {
        journalLines = JSON.parse(saved);
    } else {
        // Migration from old single-text format if it exists
        let oldText = localStorage.getItem('pakportal_journal');
        if(oldText) {
            journalLines = oldText.split('\n').filter(l => l.trim() !== '');
            localStorage.removeItem('pakportal_journal');
            saveJournalLocal();
        }
    }
    renderJournal();
}

function saveJournalLocal() {
    localStorage.setItem('pakportal_journal_lines', JSON.stringify(journalLines));
}

function handleJournalEnter(e) {
    if(e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        addJournalLine();
    }
}

function addJournalLine() {
    let input = document.getElementById('journal-input');
    if(!input) return;
    let text = input.value.trim();
    if(!text) return;
    
    journalLines.push(text);
    saveJournalLocal();
    input.value = '';
    renderJournal();
    
    let list = document.getElementById('journal-list');
    if(list) list.scrollTop = list.scrollHeight;
    
    showJournalStatus("Added ✓");
}

function renderJournal() {
    let list = document.getElementById('journal-list');
    if(!list) return;
    list.innerHTML = '';
    
    if(journalLines.length === 0) {
        list.innerHTML = `<div style="text-align: center; opacity: 0.5; margin-top: 30px; font-size: 0.9rem;">No notes yet. Type below & press Enter!</div>`;
        return;
    }
    
    journalLines.forEach((line, idx) => {
        list.innerHTML += `
            <div class="journal-item">
                <span class="urdu-text" style="flex: 1; word-wrap: break-word; margin-right: 15px; font-size: 1.1rem; line-height: 1.8;">${line}</span>
                <div style="display: flex; gap: 5px; align-items: center;">
                    <button class="journal-copy-btn" onclick="copyJournal(${idx}, this)">Copy</button>
                    <button class="exp-del-btn" onclick="deleteJournalLine(${idx})" title="Delete">×</button>
                </div>
            </div>
        `;
    });
}

function copyJournal(idx, btn) {
    let text = journalLines[idx];
    navigator.clipboard.writeText(text).then(() => {
        let oldText = btn.innerText;
        btn.innerText = "✓";
        btn.style.background = "#4CAF50";
        btn.style.color = "#fff";
        btn.style.opacity = "1";
        setTimeout(() => {
            btn.innerText = oldText;
            btn.style.background = "";
            btn.style.color = "";
            btn.style.opacity = "";
        }, 1500);
    });
}

function deleteJournalLine(idx) {
    journalLines.splice(idx, 1);
    saveJournalLocal();
    renderJournal();
}

function clearJournal() {
    if(confirm("Are you sure you want to completely clear ALL your journal notes?")) {
        journalLines = [];
        saveJournalLocal();
        renderJournal();
        showJournalStatus("Cleared!");
    }
}

function showJournalStatus(msg) {
    let status = document.getElementById('journal-status');
    if(!status) return;
    status.innerText = msg;
    status.style.opacity = '1';
    clearTimeout(window.journalStatusTimeout);
    window.journalStatusTimeout = setTimeout(() => {
        status.style.opacity = '0';
    }, 2000);
}

function setMood(moodEmoji, save = true) {
    let btns = document.querySelectorAll('.mood-btn');
    if(btns.length === 0) return;
    
    btns.forEach(btn => {
        btn.classList.remove('active');
        btn.style.opacity = '0.4';
    });
    let activeBtn = document.querySelector(`.mood-btn[data-mood="${moodEmoji}"]`);
    if(activeBtn) {
        activeBtn.classList.add('active');
        activeBtn.style.opacity = '1';
    }
    if(save) {
        localStorage.setItem('pakportal_mood', moodEmoji);
        showJournalStatus("Mood Saved!");
    }
}
// --- Initialization Updates ---
function init() {
    console.log("PakPortal initializing...");
    try {
        // Start Gadgets
        if (document.getElementById('header-clock')) {
            updateClock();
            setInterval(updateClock, 1000);
        }
        if (document.getElementById('weather-temp')) {
            fetchWeather();
        }
        if (document.getElementById('prayerTimes')) {
            updatePrayerTimes();
        }

        // Setup All Listeners Safely
        setupConverters();
        setupSearch();
        setupResizeTool();
        setupPhotoEditor();
        setupPdfMerge();
        setupBackToTop();
        
        if (document.getElementById('pak-live-hub')) {
            refreshLiveHub();
            setInterval(refreshLiveHub, 60000);
        }
        
        // Initial rates load
        updatePrayerTimes();
        
        // Load custom links
        loadCustomLinks();
        
        // Init Productivity Hub (Local Storage Only)
        initExpenses();
        loadJournal();
        
        // Load persisted values
        const savedYT = localStorage.getItem('pakportal_yt_url');
        if (savedYT && document.getElementById('ytLink')) {
            document.getElementById('ytLink').value = savedYT;
        }

        console.log("Welcome to PakPortal Metro UI");

    } catch (e) {
        console.error("Init Error:", e);
    }
}

// --- 8. Custom Links Persistence ---
function addCustomLink() {
    const nameInput = document.getElementById('customLinkName');
    const urlInput = document.getElementById('customLinkUrl');
    const name = nameInput.value.trim();
    let url = urlInput.value.trim();

    if (!name || !url) return alert("Please enter both name and URL");
    if (!url.startsWith('http')) url = 'https://' + url;

    const links = JSON.parse(localStorage.getItem('pakportal_custom_links') || '[]');
    links.push({ id: Date.now(), name, url });
    localStorage.setItem('pakportal_custom_links', JSON.stringify(links));

    nameInput.value = "";
    urlInput.value = "";
    loadCustomLinks();
}

function deleteCustomLink(id) {
    if (!confirm("Delete this link?")) return;
    let links = JSON.parse(localStorage.getItem('pakportal_custom_links') || '[]');
    links = links.filter(l => l.id !== id);
    localStorage.setItem('pakportal_custom_links', JSON.stringify(links));
    loadCustomLinks();
}

function loadCustomLinks() {
    const list = document.getElementById('customLinksList');
    if (!list) return;
    const links = JSON.parse(localStorage.getItem('pakportal_custom_links') || '[]');

    if (links.length === 0) {
        list.innerHTML = '<div style="grid-column: 1/-1; text-align: center; opacity: 0.5; padding: 20px;">No custom links saved yet.</div>';
        return;
    }

    list.innerHTML = links.map(link => `
        <div class="dashboard-category" style="margin-bottom: 0; padding: 15px; border: 1px solid rgba(166,124,82,0.1); display: flex; flex-direction: column; justify-content: space-between;">
            <div style="margin-bottom: 10px;">
                <h4 style="color: var(--text-brown); font-size: 0.9rem; margin-bottom: 5px;">${link.name}</h4>
                <a href="${link.url}" target="_blank" style="font-size: 0.75rem; color: var(--accent-gold); word-break: break-all; text-decoration: none;">${link.url.replace('https://','').replace('http://','')}</a>
            </div>
            <button onclick="deleteCustomLink(${link.id})" style="background: transparent; color: #ef4444; border: none; font-size: 0.7rem; cursor: pointer; align-self: flex-end; padding: 5px;">Delete</button>
        </div>
    `).join('');
}

// Removed redundant/buggy prayer city input listener

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

/* --- [ASIM PHOTO STUDIO - STUDIO LOGIC JS] --- */

// 1. Tab Switching Logic
function showTab(tabId) {
    const tabs = document.querySelectorAll('.s-tab-content');
    tabs.forEach(tab => {
        tab.style.display = 'none';
        tab.classList.remove('active');
    });

    const servicesCont = document.getElementById('services-section-container');
    const reviewsCont = document.getElementById('reviews-section-container');
    const tabHome = document.getElementById('tab-home');
    const tabServices = document.getElementById('tab-services');
    const tabReviews = document.getElementById('tab-reviews');
    const mapCont = document.getElementById('s-location-map');

    if (tabId === 'home') {
        if (servicesCont) tabHome.appendChild(servicesCont);
        if (reviewsCont) tabHome.appendChild(reviewsCont);
        if (mapCont) tabHome.appendChild(mapCont);
    } else if (tabId === 'services') {
        if (servicesCont) tabServices.appendChild(servicesCont);
    } else if (tabId === 'reviews') {
        if (reviewsCont) tabReviews.appendChild(reviewsCont);
    } else if (tabId === 'gallery') {
        // Gallery tab is standalone and handles its own grid
    }

    const activeTab = document.getElementById('tab-' + tabId);
    if (activeTab) {
        activeTab.style.display = 'block';
        activeTab.classList.add('active');
    }

    const navItems = document.querySelectorAll('.s-nav-item');
    navItems.forEach(item => {
        item.classList.remove('active');
    });

    const activeNav = document.getElementById('nav-' + tabId);
    if (activeNav) {
        activeNav.classList.add('active');
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });

    const studioNav = document.querySelector('.s-master-nav');
    const floatingGadgets = document.querySelector('.s-floating-gadgets');
    
    if (tabId === 'portal') {
        if (studioNav) studioNav.style.display = 'none'; 
        if (floatingGadgets) floatingGadgets.style.display = 'none';
        window.dispatchEvent(new Event('resize'));
        loadCustomLinks(); 
    } else {
        if (studioNav) studioNav.style.display = 'block';
        if (floatingGadgets) floatingGadgets.style.display = 'flex';
    }
    
    loadReviews();
}

// 2. WhatsApp Integration
function openWhatsApp() {
    const phone = "923238893382";
    const msg = encodeURIComponent("السلام علیکم عاصم فوٹو سٹوڈیو، کیا میں آپ سے رابطہ کر سکتا ہوں؟\nAssalam-o-Alaikum Asim Photo Studio, can I contact you for photography services?");
    window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
}

// 3. Review System Logic
let currentRating = 5;

function setRating(n) {
    currentRating = n;
    document.getElementById('revRating').value = n;
    const stars = document.querySelectorAll('#star-rating span');
    stars.forEach((s, idx) => {
        s.classList.toggle('active', idx < n);
    });
}

function submitReview() {
    const name = document.getElementById('revName').value.trim();
    const msg = document.getElementById('revMessage').value.trim();
    const rating = parseInt(document.getElementById('revRating').value);

    if (!name || !msg) return alert("Please enter both name and experience!");

    const reviews = JSON.parse(localStorage.getItem('s_studio_reviews') || '[]');
    reviews.unshift({
        id: Date.now(),
        name: name,
        message: msg,
        rating: rating,
        date: new Date().toLocaleDateString()
    });

    localStorage.setItem('s_studio_reviews', JSON.stringify(reviews));
    
    // Clear form
    document.getElementById('revName').value = "";
    document.getElementById('revMessage').value = "";
    setRating(5);

    loadReviews();
    alert("Review submitted successfully! / آپ کی رائے موصول ہو گئی۔ شکریہ");
}

function loadReviews() {
    const container = document.getElementById('reviews-list');
    const adminContainer = document.getElementById('admin-reviews-list');
    if (!container) return;

    // 15 Default Fake Reviews (Mixed Male/Female, English/Urdu)
    const defaultReviews = [
        { id: 1, name: "Muhammad Ali", rating: 5, message: "بہترین فوٹوگرافی! کریم پارک میں سب سے بہترین۔ Excellent Service!", date: "01/04/2026" },
        { id: 2, name: "Fatima Bibi", rating: 5, message: "میری شادی کے لیے بہت پیشہ ورانہ سروس۔ Amazing wedding coverage.", date: "01/04/2026" },
        { id: 3, name: "Ahmed Khan", rating: 5, message: "پاسپورٹ سائز تصویریں 5 منٹ میں تیار ہو گئی تھیں۔ Top speed!", date: "02/04/2026" },
        { id: 4, name: "Sara Malik", rating: 4, message: "ویڈیو کی کوالٹی بہت ہی شاندار ہے۔ Highly recommended.", date: "02/04/2026" },
        { id: 5, name: "Zeeshan", rating: 5, message: "فیملی تقریبات کے لیے پر زور مشورہ۔ Great experience.", date: "02/04/2026" },
        { id: 6, name: "Irum Shahzadi", rating: 5, message: "بہت ہی شفیق عملہ اور بہترین ماحول۔ Best studio in Lahore.", date: "02/04/2026" },
        { id: 7, name: "Usman Ghani", rating: 5, message: "جدید آلات اور ماہرانہ کام۔ Modern photography.", date: "02/04/2026" },
        { id: 8, name: "Khadija", rating: 5, message: "یادگار تصویریں، شکریہ عاصم فوٹو سٹوڈیو! Thank you so much.", date: "02/04/2026" },
        { id: 9, name: "Bilal Rathore", rating: 4, message: "لاہور میں سب سے تیز سروس۔ Quickest service in town.", date: "02/04/2026" },
        { id: 10, name: "Ayesha Ghaffar", rating: 5, message: "میری سالگرہ کے شوٹ میں رنگوں کا بہترین استعمال۔ Loved it!", date: "02/04/2026" },
        { id: 11, name: "Rana Hamid", rating: 5, message: "قابلِ بھروسہ اور سستے پیکجز۔ Reliable and affordable.", date: "02/04/2026" },
        { id: 12, name: "Zainab", rating: 5, message: "سٹوڈیو لائٹنگ بہت زبردست ہے۔ Excellent lighting.", date: "02/04/2026" },
        { id: 13, name: "Hamza", rating: 4, message: "ٹیم بہت تخلیقی ہے۔ Very creative team.", date: "02/04/2026" },
        { id: 14, name: "Saira", rating: 5, message: "اب تک کی سب سے بہترین فوٹو کوالٹی۔ Best quality ever.", date: "02/04/2026" },
        { id: 15, name: "Kamran", rating: 5, message: "ایڈیٹنگ کی مہارت کمال کی ہے۔ Top notch editing.", date: "02/04/2026" }
    ];

    const savedReviews = JSON.parse(localStorage.getItem('s_studio_reviews') || '[]');
    const deletedDefaultIds = JSON.parse(localStorage.getItem('s_studio_deleted_defaults') || '[]');
    
    // Filter out default reviews that were deleted or edited (edited versions are now in savedReviews)
    const activeDefaultReviews = defaultReviews.filter(r => !deletedDefaultIds.includes(r.id));
    
    const allReviews = [...savedReviews, ...activeDefaultReviews];
    
    // Duplicating for seamless marquee
    const marqueeReviews = [...allReviews, ...allReviews];

    // Public View (Marquee)
    container.innerHTML = marqueeReviews.map(r => `
        <div class="s-review-card">
            <div class="s-rev-stars">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</div>
            <div class="s-rev-name">${r.name}</div>
            <div class="s-rev-msg urdu-text">${r.message}</div>
            <div style="font-size:0.7rem; opacity:0.5; margin-top:10px;">${r.date}</div>
        </div>
    `).join('');

    // Admin View (Full List for management)
    if (adminContainer) {
        adminContainer.innerHTML = allReviews.map((r) => `
            <div class="s-admin-rev" style="background:rgba(255,255,255,0.05); margin-bottom:10px; border-radius:12px; padding:15px; border:1px solid rgba(0,0,0,0.05);">
                <div style="flex:1;">
                    <div style="font-weight: 800; color: var(--text-brown);">${r.name} <span style="color:var(--accent-gold);">${'★'.repeat(r.rating)}</span></div>
                    <div style="font-size: 0.85rem; opacity: 0.8; margin-top:5px; line-height:1.4;">${r.message}</div>
                    <div style="font-size: 0.7rem; opacity: 0.5; margin-top:5px;">${r.date} ${r.id <= 15 ? '<span style="color:var(--accent-gold); font-weight:800;">(SYSTEM)</span>' : ''}</div>
                </div>
                <div style="display:flex; flex-direction:column; gap:5px;">
                    <button onclick="editReview(${r.id})" class="s-edit-btn">EDIT</button>
                    <button onclick="deleteReview(${r.id})" class="s-del-btn">DELETE</button>
                </div>
            </div>
        `).join('');
    }
}

// 4. Admin Logic
function verifyAdmin() {
    const pass = document.getElementById('adminPass').value;
    if (pass === "asim786") {
        document.getElementById('admin-login').style.display = 'none';
        document.getElementById('admin-panel').style.display = 'block';
        loadReviews();
    } else {
        alert("Incorrect Password!");
    }
}

function logoutAdmin() {
    document.getElementById('admin-login').style.display = 'block';
    document.getElementById('admin-panel').style.display = 'none';
    document.getElementById('adminPass').value = "";
}

function deleteReview(id) {
    if (!confirm("Are you sure you want to delete/cancel this review?")) return;
    
    if (id <= 15) {
        // Default Review Management
        const deletedDefaultIds = JSON.parse(localStorage.getItem('s_studio_deleted_defaults') || '[]');
        if (!deletedDefaultIds.includes(id)) {
            deletedDefaultIds.push(id);
            localStorage.setItem('s_studio_deleted_defaults', JSON.stringify(deletedDefaultIds));
        }
    } else {
        // User Review Management
        let reviews = JSON.parse(localStorage.getItem('s_studio_reviews') || '[]');
        reviews = reviews.filter(r => r.id !== id);
        localStorage.setItem('s_studio_reviews', JSON.stringify(reviews));
    }
    
    loadReviews();
    alert("Review deleted/canceled successfully.");
}

function editReview(id) {
    const savedReviews = JSON.parse(localStorage.getItem('s_studio_reviews') || '[]');
    const defaultReviews = [
        { id: 1, name: "Muhammad Ali", rating: 5, message: "بہترین فوٹوگرافی! کریم پارک میں سب سے بہترین۔ Excellent Service!", date: "01/04/2026" },
        { id: 2, name: "Fatima Bibi", rating: 5, message: "میری شادی کے لیے بہت پیشہ ورانہ سروس۔ Amazing wedding coverage.", date: "01/04/2026" },
        { id: 3, name: "Ahmed Khan", rating: 5, message: "پاسپورٹ سائز تصویریں 5 منٹ میں تیار ہو گئی تھیں۔ Top speed!", date: "02/04/2026" },
        { id: 4, name: "Sara Malik", rating: 4, message: "ویڈیو کی کوالٹی بہت ہی شاندار ہے۔ Highly recommended.", date: "02/04/2026" },
        { id: 5, name: "Zeeshan", rating: 5, message: "فیملی تقریبات کے لیے پر زور مشورہ۔ Great experience.", date: "02/04/2026" },
        { id: 6, name: "Irum Shahzadi", rating: 5, message: "بہت ہی شفیق عملہ اور بہترین ماحول۔ Best studio in Lahore.", date: "02/04/2026" },
        { id: 7, name: "Usman Ghani", rating: 5, message: "جدید آلات اور ماہرانہ کام۔ Modern photography.", date: "02/04/2026" },
        { id: 8, name: "Khadija", rating: 5, message: "یادگار تصویریں، شکریہ عاصم فوٹو سٹوڈیو! Thank you so much.", date: "02/04/2026" },
        { id: 9, name: "Bilal Rathore", rating: 4, message: "لاہور میں سب سے تیز سروس۔ Quickest service in town.", date: "02/04/2026" },
        { id: 10, name: "Ayesha Ghaffar", rating: 5, message: "میری سالگرہ کے شوٹ میں رنگوں کا بہترین استعمال۔ Loved it!", date: "02/04/2026" },
        { id: 11, name: "Rana Hamid", rating: 5, message: "قابلِ بھروسہ اور سستے پیکجز۔ Reliable and affordable.", date: "02/04/2026" },
        { id: 12, name: "Zainab", rating: 5, message: "سٹوڈیو لائٹنگ بہت زبردست ہے۔ Excellent lighting.", date: "02/04/2026" },
        { id: 13, name: "Hamza", rating: 4, message: "ٹیم بہت تخلیقی ہے۔ Very creative team.", date: "02/04/2026" },
        { id: 14, name: "Saira", rating: 5, message: "اب تک کی سب سے بہترین فوٹو کوالٹی۔ Best quality ever.", date: "02/04/2026" },
        { id: 15, name: "Kamran", rating: 5, message: "ایڈیٹنگ کی مہارت کمال کی ہے۔ Top notch editing.", date: "02/04/2026" }
    ];

    let targetReview = savedReviews.find(r => r.id === id) || defaultReviews.find(r => r.id === id);

    if (!targetReview) return alert("Review not found.");

    const newName = prompt("Edit Reviewer Name:", targetReview.name);
    if (!newName) return;
    const newMessage = prompt("Edit Review Message:", targetReview.message);
    if (!newMessage) return;
    const newRating = parseInt(prompt("Edit Rating (1-5):", targetReview.rating));
    if (isNaN(newRating) || newRating < 1 || newRating > 5) return alert("Invalid Rating");

    if (id <= 15) {
        // Converting a default review to a saved review (and hiding the default)
        const deletedDefaultIds = JSON.parse(localStorage.getItem('s_studio_deleted_defaults') || '[]');
        if (!deletedDefaultIds.includes(id)) {
            deletedDefaultIds.push(id);
            localStorage.setItem('s_studio_deleted_defaults', JSON.stringify(deletedDefaultIds));
        }
        
        savedReviews.unshift({
            id: Date.now(), // Give it a new unique user ID
            name: newName,
            message: newMessage,
            rating: newRating,
            date: targetReview.date + " (Edited)"
        });
    } else {
        // Updating existing user review
        targetReview.name = newName;
        targetReview.message = newMessage;
        targetReview.rating = newRating;
    }

    localStorage.setItem('s_studio_reviews', JSON.stringify(savedReviews));
    loadReviews();
    alert("Review updated successfully!");
}

// 5. Special Hero Slider Logic
let currentSlide = 0;
function initHeroSlider() {
    const slides = document.querySelectorAll('.s-slide');
    if (slides.length === 0) return;
    
    setInterval(() => {
        slides[currentSlide].classList.remove('active');
        currentSlide = (currentSlide + 1) % slides.length;
        slides[currentSlide].classList.add('active');
    }, 5000);
}

// 6. Lightbox Logic
function openLightbox(src) {
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightbox-img');
    if (lightbox && lightboxImg) {
        lightboxImg.src = src;
        lightbox.style.display = 'block';
        document.body.style.overflow = 'hidden'; // Disable scroll
    }
}

function closeLightbox() {
    const lightbox = document.getElementById('lightbox');
    if (lightbox) {
        lightbox.style.display = 'none';
        document.body.style.overflow = 'auto'; // Enable scroll
    }
}

// 7. Special Seamless Loop for Work Slider
function setupWorkSlider() {
    const slider = document.querySelector('.s-work-slider');
    if (slider) {
        const items = Array.from(slider.children);
        // Duplicate items for infinite scroll effect
        items.forEach(item => {
            const clone = item.cloneNode(true);
            slider.appendChild(clone);
        });
    }
}

// Global Init Hook
document.addEventListener('DOMContentLoaded', () => {
    console.log("Asim Studio Initializing...");
    setupConverters();
    setupResizeTool();
    setupPhotoEditor();
    setupPdfMerge();
    setupBackToTop();
    setupSearch();
    
    // Start Gadgets - FORCE LAHORE
    updateClock();
    setInterval(updateClock, 1000);
    fetchWeather("Lahore");
    setInterval(() => fetchWeather("Lahore"), 600000);
    
    loadReviews();
    initHeroSlider(); // NEW: Start Slider
    setupWorkSlider(); // NEW: Setup Infinite Work Slider
    showTab('home');
});
