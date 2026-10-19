// AttackSimulation.js
const targetUrl = 'http://127.0.0.1:8080/attack-payload';

// Function to simulate sending large payloads (Oversized Requests)
async function fireAttack() {
    console.log("Starting malicious attack simulation (Oversized Payloads)...");
    
    for (let i = 0; i < 50; i++) {
        try {
            // Generate a 1MB payload of garbage data
            const bigPayload = 'A'.repeat(1000000); 
            const res = await fetch(`${targetUrl}?data=${bigPayload}`);
            const text = await res.text();
            console.log(`Attack ${i + 1}: Result -> ${text}`);
        } catch (error) {
            console.log(`Attack ${i + 1}: Request failed or timed out -> ${error.message}`);
        }
    }
}

// Function to simulate a burst of concurrent requests (DoS / Flooding)
async function floodAttack() {
    console.log("Starting flood attack simulation...");
    const promises = [];
    // Send 100 requests at the exact same time
    for (let i = 0; i < 100; i++) {
        promises.push(fetch('http://127.0.0.1:8080/flood').then(res => res.text()));
    }
    const results = await Promise.all(promises);
    console.log("Flood attack sample results (First 5):", results.slice(0, 5));
}

// Execute the attacks
fireAttack();
// Uncomment the line below later to test the flood attack
// floodAttack(); 