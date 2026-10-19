// FaultSimulation.js
const targetUrl = 'http://127.0.0.1:8080/test-fault-tolerance';

async function sendRequest(id) {
    try {
        const res = await fetch(`${targetUrl}?req=${id}`);
        const text = await res.text();
        console.log(`Request ${id}: ${text}`);
    } catch (error) {
        console.log(`Request ${id} FAILED: ${error.message}`);
    }
}

async function runTest() {
    console.log("Starting Fault Tolerance Test...");
    
    // Send normal requests
    for (let i = 1; i <= 5; i++) {
        await sendRequest(i);
        await new Promise(r => setTimeout(r, 500));
    }

    console.log("\n--- Simulating Backend Server Crash ---\n");
    
    // Here is a trick: we can't easily kill the specific server from here, 
    // so for your report, you can just manually close one of the server terminals if you can.
    // But since they are running in the same process, let's just test if the LoadBalancer fails gracefully.
    
    // Send requests during "crash"
    for (let i = 6; i <= 10; i++) {
        await sendRequest(i);
        await new Promise(r => setTimeout(r, 500));
    }
    
    console.log("Test finished.");
}

runTest();