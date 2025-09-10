// HTML content for the UI
const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Trading Education Bot Control Panel</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-100 p-8">
    <div class="max-w-4xl mx-auto bg-white rounded-lg shadow-lg p-6">
        <h1 class="text-2xl font-bold mb-6">Trading Education Bot Control Panel</h1>
        
        <!-- Content Generation Form -->
        <div class="mb-8 p-6 border rounded-lg">
            <h2 class="text-xl font-semibold mb-4">Generate & Post Content</h2>
            <form id="generateForm" class="space-y-4">
                <div>
                    <label class="block text-sm font-medium mb-2">Topic/Subject</label>
                    <input type="text" id="subject" class="w-full p-2 border rounded"
                           placeholder="e.g., Risk Management in Crypto">
                </div>
                
                <div>
                    <label class="block text-sm font-medium mb-2">Market Type</label>
                    <select id="market" class="w-full p-2 border rounded">
                        <option value="crypto">Cryptocurrency</option>
                        <option value="forex">Forex</option>
                        <option value="stocks">Stocks</option>
                    </select>
                </div>

                <div>
                    <label class="block text-sm font-medium mb-2">AI Model</label>
                    <select id="model" class="w-full p-2 border rounded">
                        <option value="gpt-3.5-turbo">GPT-3.5 Turbo (Fast)</option>
                        <option value="gpt-4">GPT-4 (High Quality)</option>
                        <option value="claude-2">Claude 2 (Detailed)</option>
                        <option value="palm2">PaLM 2 (Alternative)</option>
                    </select>
                </div>

                <div class="preview-section hidden mt-4 p-4 bg-gray-50 rounded">
                    <h3 class="font-medium mb-2">Preview</h3>
                    <p id="previewText" class="text-gray-700"></p>
                </div>

                <div class="flex space-x-4">
                    <button type="button" id="generateBtn" 
                            class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
                        Generate Preview
                    </button>
                    <button type="button" id="postBtn"
                            class="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600">
                        Post to Telegram
                    </button>
                </div>
            </form>
        </div>

        <!-- Schedule Management -->
        <div class="mb-8 p-6 border rounded-lg">
            <h2 class="text-xl font-semibold mb-4">Schedule Management</h2>
            <form id="scheduleForm" class="space-y-4">
                <div>
                    <label class="block text-sm font-medium mb-2">Posting Schedule</label>
                    <select id="schedule" class="w-full p-2 border rounded">
                        <option value="0 * * * *">Every hour</option>
                        <option value="0 */2 * * *">Every 2 hours</option>
                        <option value="0 */4 * * *">Every 4 hours</option>
                        <option value="0 */6 * * *">Every 6 hours</option>
                        <option value="0 */12 * * *">Every 12 hours</option>
                        <option value="0 0 * * *">Once per day (00:00)</option>
                        <option value="0 12 * * *">Once per day (12:00)</option>
                        <option value="0 0,12 * * *">Twice per day (00:00, 12:00)</option>
                    </select>
                </div>

                <button type="button" id="updateScheduleBtn"
                        class="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600">
                    Update Schedule
                </button>
            </form>
        </div>

        <!-- Status Section -->
        <div id="status" class="mt-4 p-4 rounded hidden">
            <p class="text-center font-medium"></p>
        </div>
    </div>

    <script>
        const API_BASE = '/api';
        let generatedContent = '';

        // Check for saved token
        document.addEventListener('DOMContentLoaded', () => {
            const token = localStorage.getItem('adminToken');
            if (token) {
                document.getElementById('auth-section').classList.add('hidden');
                document.getElementById('main-content').classList.remove('hidden');
            }
        });

        // Handle login
        document.getElementById('login-btn').addEventListener('click', () => {
            const token = document.getElementById('admin-token').value;
            if (!token) {
                showStatus('Please enter an admin token', 'error');
                return;
            }
            localStorage.setItem('adminToken', token);
            document.getElementById('auth-section').classList.add('hidden');
            document.getElementById('main-content').classList.remove('hidden');
        });

        async function showStatus(message, type = 'success') {
            const status = document.getElementById('status');
            status.className = \`mt-4 p-4 rounded \${type === 'success' ? 'bg-green-100' : 'bg-red-100'}\`;
            status.querySelector('p').textContent = message;
            status.classList.remove('hidden');
            setTimeout(() => status.classList.add('hidden'), 5000);
        }

            async function generateContent() {
            const subject = document.getElementById('subject').value;
            const market = document.getElementById('market').value;
            const model = document.getElementById('model').value;
            const token = localStorage.getItem('adminToken');
            
            if (!token) {
                showStatus('Please enter your admin token first', 'error');
                return;
            }
            
            try {
                const response = await fetch(\`\${API_BASE}/generate\`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify({ subject, market, model })
                });                if (!response.ok) throw new Error('Generation failed');

                const data = await response.json();
                generatedContent = data.content;

                document.querySelector('.preview-section').classList.remove('hidden');
                document.getElementById('previewText').textContent = generatedContent;
                showStatus('Content generated successfully');
            } catch (error) {
                showStatus(\`Failed to generate content: \${error.message}\`, 'error');
            }
        }

            async function postContent() {
            if (!generatedContent) {
                showStatus('Please generate content first', 'error');
                return;
            }

            const token = localStorage.getItem('adminToken');
            if (!token) {
                showStatus('Please enter your admin token first', 'error');
                return;
            }

            try {
                const response = await fetch(\`\${API_BASE}/post\`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify({ content: generatedContent })
                });                if (!response.ok) throw new Error('Posting failed');

                showStatus('Posted successfully to Telegram');
                generatedContent = '';
                document.querySelector('.preview-section').classList.add('hidden');
            } catch (error) {
                showStatus(\`Failed to post: \${error.message}\`, 'error');
            }
        }

            async function updateSchedule() {
            const schedule = document.getElementById('schedule').value;
            
            const token = localStorage.getItem('adminToken');
            if (!token) {
                showStatus('Please enter your admin token first', 'error');
                return;
            }

            try {
                const response = await fetch(\`\${API_BASE}/schedule\`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify({ schedule })
                });                if (!response.ok) throw new Error('Schedule update failed');

                showStatus('Schedule updated successfully');
            } catch (error) {
                showStatus(\`Failed to update schedule: \${error.message}\`, 'error');
            }
        }

        // Event Listeners
        document.getElementById('generateBtn').addEventListener('click', generateContent);
        document.getElementById('postBtn').addEventListener('click', postContent);
        document.getElementById('updateScheduleBtn').addEventListener('click', updateSchedule);

        // Load current schedule on page load
        fetch(\`\${API_BASE}/schedule\`)
            .then(res => res.json())
            .then(data => {
                document.getElementById('schedule').value = data.schedule;
            })
            .catch(console.error);
    </script>
</body>
</html>`;
