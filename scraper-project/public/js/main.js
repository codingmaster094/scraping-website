document.addEventListener('DOMContentLoaded', () => {
    const darkModeToggle = document.getElementById('darkModeToggle');
    const startScrapingBtn = document.getElementById('startScrapingBtn');
    const urlInput = document.getElementById('urlInput');
    const loader = document.getElementById('loader');
    const statusDiv = document.getElementById('status');
    const resultsBody = document.getElementById('resultsBody');
    const totalCompaniesSpan = document.getElementById('totalCompanies');

    // Dark Mode
    darkModeToggle.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
    });

    startScrapingBtn.addEventListener('click', async () => {
        const url = urlInput.value.trim();
        if (!url) {
            alert('Please enter a URL.');
            return;
        }

        // Reset UI
        resultsBody.innerHTML = '';
        totalCompaniesSpan.textContent = '0';
        statusDiv.textContent = 'Starting scraper...';
        loader.style.display = 'block';

        try {
            const response = await fetch('/api/scrape', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ url }),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            renderResults(data);
            statusDiv.textContent = 'Scraping finished.';

        } catch (error) {
            console.error('Scraping error:', error);
            statusDiv.textContent = 'An error occurred during scraping.';
        } finally {
            loader.style.display = 'none';
        }
    });

    function renderResults(data) {
        resultsBody.innerHTML = '';
        totalCompaniesSpan.textContent = data.length;

        if (data.length === 0) {
            resultsBody.innerHTML = '<tr><td colspan="12">No results found.</td></tr>';
            return;
        }

        data.forEach(item => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${item.companyName || ''}</td>
                <td><a href="${item.website || ''}" target="_blank">${item.website || ''}</a></td>
                <td>${item.emails ? item.emails.join(', ') : ''}</td>
                <td>${item.phoneNumbers ? item.phoneNumbers.join(', ') : ''}</td>
                <td>${item.services ? item.services.join(', ') : ''}</td>
                <td>${item.technologies ? item.technologies.join(', ') : ''}</td>
                <td>${item.framework || ''}</td>
                <td>${item.cms || ''}</td>
                <td>${item.socialLinks ? Object.entries(item.socialLinks).map(([key, value]) => `<a href="${value}" target="_blank">${key}</a>`).join(' ') : ''}</td>
                <td>${item.googleRating || ''}</td>
                <td>${item.totalReviews || ''}</td>
                <td>${item.address || ''}</td>
            `;
            resultsBody.appendChild(row);
        });
    }

    // TODO: Implement search, pagination, and export functionality
});
