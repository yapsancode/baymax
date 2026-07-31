"""Hardcoded GCP guides (test seed data).

Eventually these steps come from the LangChain/Gemini chatbot in
services/chat_service.py; this constant is a fixed example used by the
POST /sessions/{session_id}/steps route.
"""

CLOUD_SQL_POSTGRES_GUIDE = {
    "id": "cloud-sql-postgres",
    "title": "Set up Cloud SQL for PostgreSQL",
    "description": "Step-by-step guide to create a PostgreSQL instance in the GCP Console.",
    "steps": [
        {
            "step_number": 1,
            "title": "Search for Cloud SQL",
            "description": 'Click the search bar at the top of the console and type "Cloud SQL". You can find any GCP product this way.',
            "action": "fill",
            "selector": 'input[name="q"], input[aria-label*="Search" i][role="combobox"], form[role="search"] input, input[placeholder*="Search" i]',
            "value": "Cloud SQL",
            "advanceOnUrlPattern": "/sql/instances",
        },
        {
            "step_number": 2,
            "title": "Open SQL from the results",
            "description": 'Pick "SQL" from the search results to open the Cloud SQL page.',
            "action": "click",
            "selector": 'a[href*="/sql/instances"], [role="listbox"] a[href*="/sql"], [role="option"] a[href*="/sql"], a[track-name*="cloudsql" i]',
            "advanceOnUrlPattern": "/sql/instances",
        },
        {
            "step_number": 3,
            "title": "Create an instance",
            "description": "You're in Cloud SQL now. Click \"Create instance\" to start a new database.",
            "action": "click",
            "selector": '[data-test-id="create-instance-button"], a[href*="/sql/choose-instance-engine"], a[aria-label*="Create instance" i]',
            "url": "https://console.cloud.google.com/sql/instances",
            "urlPattern": "/sql/instances",
            "advanceOnUrlPattern": "/sql/choose-instance-engine",
        },
        {
            "step_number": 4,
            "title": "Choose PostgreSQL",
            "description": "Select PostgreSQL as the database engine for your new instance.",
            "action": "click",
            "selector": '[data-test-id="engine-postgres"], button[aria-label*="PostgreSQL" i], a[href*="postgres" i]',
            "url": "https://console.cloud.google.com/sql/choose-instance-engine",
            "urlPattern": "/sql/choose-instance-engine",
            "advanceOnUrlPattern": "/sql/(postgres/)?create-instance",
        },
        {
            "step_number": 5,
            "title": "Name your instance",
            "description": 'Enter an instance ID, for example "baymax-postgres".',
            "action": "fill",
            "selector": 'input[name="instanceId"], input#instance-id, input[formcontrolname="instanceId"]',
            "value": "baymax-postgres",
            "url": "https://console.cloud.google.com/sql/postgres/create-instance",
            "urlPattern": "/sql/(postgres/)?create-instance",
        },
        {
            "step_number": 6,
            "title": "Set a password",
            "description": "Enter a password for the default postgres user. Make sure to remember it — you'll need it to connect later.",
            "action": "highlight",
            "selector": 'input[name="password"], input[type="password"], input[formcontrolname="password"]',
            "url": "https://console.cloud.google.com/sql/postgres/create-instance",
            "urlPattern": "/sql/(postgres/)?create-instance",
        },
        {
            "step_number": 7,
            "title": "Choose a region",
            "description": "Pick the region closest to you, for example asia-southeast1.",
            "action": "highlight",
            "selector": 'mat-select[name="region"], [data-test-id="region-select"], mat-select[formcontrolname="region"]',
            "url": "https://console.cloud.google.com/sql/postgres/create-instance",
            "urlPattern": "/sql/(postgres/)?create-instance",
        },
        {
            "step_number": 8,
            "title": "Pick the Sandbox edition",
            "description": "Choose the Sandbox edition to keep costs low while you develop.",
            "action": "click",
            "selector": '[data-test-id="edition-sandbox"], button[aria-label*="Sandbox" i]',
            "url": "https://console.cloud.google.com/sql/postgres/create-instance",
            "urlPattern": "/sql/(postgres/)?create-instance",
        },
        {
            "step_number": 9,
            "title": "Create the instance",
            "description": "Click \"Create instance\" to start provisioning your PostgreSQL database. This can take a few minutes.",
            "action": "click",
            "selector": '[data-test-id="submit-button"], button[type="submit"]',
            "url": "https://console.cloud.google.com/sql/postgres/create-instance",
            "urlPattern": "/sql/(postgres/)?create-instance",
            "advanceOnUrlPattern": "/sql/instances(?!.*create)",
        },
    ],
}
