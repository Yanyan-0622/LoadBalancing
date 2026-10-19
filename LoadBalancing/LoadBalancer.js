import * as http from "http"
import crypto from "crypto"

import ServerFactory from "./ServerFactory.js"
import Utils from "./Util.js"

const host = '127.0.0.1'
const port = 8080

var configuration = undefined
var serverFactory = undefined
var loadBalancingAlgorithm = undefined

// --- DEFENSE MECHANISMS (Task B) ---
const MAX_PAYLOAD_SIZE = 5000; // Limit URL length to prevent oversized payloads
const RATE_LIMIT_WINDOW_MS = 1000; // 1 second window
const MAX_REQUESTS_PER_WINDOW = 5; // Max 5 requests per IP per second
const ipRequestCounts = new Map(); // Track IPs

export default class LoadBalancer {

    constructor(configuration_) {
        configuration = configuration_

        if (Utils.getAlgorithm(configuration.LoadBalancingAlgorithm) === Utils.Algorithm.RoundRobin) {
            loadBalancingAlgorithm = new RoundRobin(configuration.NoServers)
        }
        else if (Utils.getAlgorithm(configuration.LoadBalancingAlgorithm)  === Utils.Algorithm.LeastConnections) {
            loadBalancingAlgorithm = new LeastConnections()
        }
        else if (Utils.getAlgorithm(configuration.LoadBalancingAlgorithm)  === Utils.Algorithm.ConsistentHashing) {
            loadBalancingAlgorithm = new ConsistentHashing(configuration.NoServers, configuration.Replicas)
        }

        let httpserver = http.createServer(
            async function (req, res) {
                res.setHeader("Content-Type", "application/json");
                
                // --- DEFENSE LOGIC START ---
                const clientIp = req.socket.remoteAddress;

                // 1. Rate Limiting (Prevent Flooding/DoS)
                let currentTime = Date.now();
                let clientData = ipRequestCounts.get(clientIp) || { count: 0, startTime: currentTime };

                if (currentTime - clientData.startTime > RATE_LIMIT_WINDOW_MS) {
                    // Reset window
                    clientData = { count: 1, startTime: currentTime };
                } else {
                    clientData.count++;
                }
                ipRequestCounts.set(clientIp, clientData);

                if (clientData.count > MAX_REQUESTS_PER_WINDOW) {
                    console.log(`[DEFENSE] Blocked request from ${clientIp} due to Rate Limiting.`);
                    res.writeHead(429); // 429 Too Many Requests
                    return res.end("Session ACCESS DENIED - Rate limit exceeded (Too Many Requests)");
                }

                // 2. Oversized Payload Limiting
                if (req.url.length > MAX_PAYLOAD_SIZE) {
                    console.log(`[DEFENSE] Blocked oversized payload from ${clientIp}. Size: ${req.url.length}`);
                    res.writeHead(413); // 413 Payload Too Large
                    return res.end("Session ACCESS DENIED - Payload size too large");
                }
                // --- DEFENSE LOGIC END ---

                switch (req.url) {
                    case "/":
                        res.writeHead(200);
                        res.end(`LoadBalancer is running on http://${host}:${port}/\n\nTo make a session request - http://${host}:${port}/[request]`);
                        break
                    default:
                        res.writeHead(200);

                        let serverindex = loadBalancingAlgorithm.getNext(req.url)
                        let nextInLineServer = serverFactory.getServerName(serverindex)

                        //route load to next legitimate server
                        http.get(`${nextInLineServer}/start`, resp => {
                            let data = ''
                            resp.on('data', chunk => {
                                data += chunk
                            })
                            resp.on('end', () => {
                                res.end(data);
                            })
                        }).on('error', (err) => {
                            // Fault Tolerance: If server is down, deny gracefully instead of crashing
                            console.log(`[FAULT TOLERANCE] Server ${nextInLineServer} is down.`);
                            res.end(`Session ACCESS DENIED - Backend server unavailable`);
                        });
                        break
                }
            }
        );
        httpserver.listen(port, host, () => {
            console.log(`LoadBalancer is running on http://${host}:${port}`)

            serverFactory = new ServerFactory()
            serverFactory.createServers(configuration)
        });

    }
}


class LeastConnections {
    constructor() {
        this.next = -1
    }

    getNext() {
        this.next = serverFactory.getServerWithMinConnectionsIndex()
        return this.next
    }
}

class RoundRobin {
    constructor(max) {
        this.next = -1
        this.max = max
    }

    getNext() {
        this.next = this.next + 1

        if (this.next >= this.max) {
            this.next = 0
        }
        return `S${this.next}`
    }
}

class ConsistentHashing {
    constructor(noservers_, replicas_) {
        this.noservers = noservers_
        this.replicas = replicas_
        this.hashmap = new Map()
      
        for (let i = 0; i < this.replicas; i++) {// replica
            for (let j = 0; j < this.noservers; j++) {

                let server_hash = crypto.createHash('md5').update(`__S${j}${i}`).digest('hex');
                this.hashmap.set(`__S${j}${i}`,server_hash)
            }
        }
    }

    addClient(requestid){
        if(!this.hashmap.has(requestid)){
            let request_hash = crypto.createHash('md5').update(requestid).digest('hex');
            this.hashmap.set(requestid,request_hash)
        }        
    }

    removeNode(nodeid){
        this.hashmap.delete(nodeid)
    }

    getNext(requestid){
        this.addClient(requestid)

        let serverid = undefined
        const hashmap_sorted = new Map([...this.hashmap.entries()].sort((a, b) => a[1].localeCompare(b[1])));
        
        let rfound = false
        for (let [key, value] of hashmap_sorted) {
            if(key === requestid){
                rfound = true
            }

            if(rfound){
                if(key.startsWith("__S")){
                    serverid = removeN(key,2)
                    if(this.noservers < 10){
                        serverid = serverid.substring(0, 2);
                    }
                    else if(this.noservers <100){
                        serverid = serverid.substring(0, 3);
                    }
                    else if(this.noservers <1000){
                        serverid = serverid.substring(0, 4);
                    }
                    break
                }
            }
        }

        return serverid
    }

}

//util functions
const removeN = (str, num) => {
    const { length } = str;
    if(num > length){
       return str;
    };
    const newStr = str.substr(num, length - num);
    return newStr;
 };