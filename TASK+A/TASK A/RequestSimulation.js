import http from "node:http";

function sendRequest() {
    return new Promise((resolve) => {
        const request = http.get(
            "http://127.0.0.1:8080/hello",
            (response) => {
                let body = "";

                response.on("data", (chunk) => {
                    body += chunk;
                });

                response.on("end", () => {
                    console.log("Response:", body);
                    if (body.includes("Session ACCESS GRANTED")) {
                        resolve("SUCCESS");
                    } else if (body.includes("Session ACCESS DENIED")) {
                       if (body.includes("No server available")) {
                             resolve("SERVER_DENIED");
                    } else if (body.includes("not available in datastore")) {
                            resolve("STORAGE_DENIED");
                    } else {
                            resolve("OTHER_DENIED");
                    }
                    } else {
                        resolve("UNEXPECTED");
                    }
                });

                response.on("error", () => {
                    resolve("ERROR");
                });
            }
        );

        request.on("error", () => {
            resolve("ERROR");
        });

        request.setTimeout(5000, () => {
            request.destroy(new Error("Request timed out"));
        });
    });
}

const totalRequests = 40;
const intervalMs = 450;

const counts = {
    SUCCESS: 0,
    SERVER_DENIED: 0,
    STORAGE_DENIED: 0,
    OTHER_DENIED: 0,
    ERROR: 0,
    UNEXPECTED: 0
};

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

const pendingRequests = [];

for (let i = 1; i <= totalRequests; i++) {
    const requestNumber = i;

    // Start the request without waiting for its response.
    const task = sendRequest().then((result) => {
        counts[result]++;
        console.log(`Request ${requestNumber}: ${result}`);
    });

    pendingRequests.push(task);

    if (i < totalRequests) {
        await sleep(intervalMs);
    }
}

// Wait until every request has returned a result.
await Promise.all(pendingRequests);

console.log("\n--- Summary ---");
console.log(`Interval: ${intervalMs} ms`);
console.log(`Total requests: ${totalRequests}`);
console.log(`Successful requests: ${counts.SUCCESS}`);
console.log(`Server-capacity denials: ${counts.SERVER_DENIED}`);
console.log(`Storage-capacity denials: ${counts.STORAGE_DENIED}`);
console.log(`Other denials: ${counts.OTHER_DENIED}`);
console.log(`Connection/response errors: ${counts.ERROR}`);
console.log(`Unexpected responses: ${counts.UNEXPECTED}`);
console.log(
    `Success rate: ${(counts.SUCCESS / totalRequests * 100).toFixed(2)}%`
);
console.log(
    `Failure rate: ${((totalRequests - counts.SUCCESS) / totalRequests * 100).toFixed(2)}%`
);