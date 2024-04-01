const http = require('http');
const url = require('url');
const querystring = require('querystring');
const mysql = require('mysql');
var mqtt = require('mqtt')

const connection = mysql.createConnection({
    host: 'sql6.freesqldatabase.com',
    user: 'sql6695402',
    password: 'MNF9RjyaPA',
    database: 'sql6695402',
    port: 3306
});

const PORT = 3000;

const mqttOptions = {
    host: 'c99974ff8b7343ea95758f4c6900543b.s1.eu.hivemq.cloud',
    port: 8883,
    protocol: 'mqtts',
    username: '20521472',
    password: 'Khoa20521472'
};

// Initialize the MQTT client
const mqttClient = mqtt.connect(mqttOptions);


function check_plate(License_ID){
    connection.query('SELECT * FROM L_Plate WHERE License_ID = ?', [License_ID], (err, result) => {
        if (err) throw err;
        mqttClient.publish('gate/open', '1');
    });
}


mqttClient.on('connect', function () {
    console.log('MQTT Client Connected');
});

mqttClient.on('error', function (error) {
    console.error('MQTT Error:', error);
});

mqttClient.on('message', function (topic, message) {
    console.log('Received MQTT message:', topic, message.toString());
    check_plate(message.toString())
    // You can handle incoming MQTT messages here
});


const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url);
    const parsedQuery = querystring.parse(parsedUrl.query);
    let body = '';

    req.on('data', (chunk) => {
        body += chunk.toString();
    });

    req.on('end', async () => {
        try {
            //connection.connect();

            if (parsedUrl.pathname === '/login' && req.method === 'POST') {
                const { username, password } = JSON.parse(body);
                connection.query('SELECT User_DB.User_ID, User_DB.Password, User_DB.Phone, L_Plate.License_ID FROM User_DB LEFT JOIN L_Plate ON User_DB.User_ID = L_Plate.User_ID WHERE User_DB.User_ID = ? AND User_DB.Password = ?', [username, password], (err, result) => {
                    if (err) throw err;
                    if (result.length > 0) {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ message: 'Login successful', user: result[0] }));
                    } else {
                        res.writeHead(401, { 'Content-Type': 'text/plain' });
                        res.end('Invalid username or password');
                    }
                });
            } else if (parsedUrl.pathname === '/change-password' && req.method === 'POST') {
                const { username, oldPassword, newPassword } = JSON.parse(body);
                connection.query('SELECT * FROM User_DB WHERE User_ID = ? AND Password = ?', [username, oldPassword], (err, result) => {
                    if (err) throw err;
                    if (result.length > 0) {
                        connection.query('UPDATE User_DB SET Password = ? WHERE User_ID = ?', [newPassword, username], (err, result) => {
                            if (err) throw err;
                            res.writeHead(200, { 'Content-Type': 'text/plain' });
                            res.end('Password changed successfully');
                        });
                    } else {
                        res.writeHead(401, { 'Content-Type': 'text/plain' });
                        res.end('Invalid username or password');
                    }
                });
            } else if (parsedUrl.pathname === '/history-event' && req.method === 'GET') {
                // Assuming the user is logged in and authenticated
                const { License_ID } = JSON.parse(body);
                connection.query('SELECT * FROM Event_DB WHERE License_ID = ?', [License_ID], (err, result) => {
                    if (err) throw err;
                    console.log(result);
                    console.log(License_ID);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(result));
                });
            } else if (parsedUrl.pathname === '/personal-data' && req.method === 'GET') {
                // Assuming the User_DB is logged in and authenticated
                const { username } = parsedQuery;
                connection.query('SELECT * FROM User_DB WHERE User_ID = ?', [username], (err, result) => {
                    if (err) throw err;
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(result[0]));
                });
            } else if (parsedUrl.pathname === '/admin/modify' && req.method === 'POST') {
                // Assuming admin authentication is done elsewhere
                const { table, newData } = JSON.parse(body);
                const entries = Object.entries(newData);
                const updates = entries.map(([key, value]) => `${key} = '${value}'`).join(', ');
                connection.query(`UPDATE ${table} SET ${updates}`, (err, result) => {
                    if (err) throw err;
                    res.writeHead(200, { 'Content-Type': 'text/plain' });
                    res.end('Data modified successfully');
                });
            } else if (parsedUrl.pathname === '/register-user' && req.method === 'POST') {
                // Assuming admin authentication is done elsewhere
                const { username, password, phone } = JSON.parse(body);
                connection.query('INSERT INTO User_DB (User_ID, Password, Phone) VALUES (?, ?, ?)', [username, password, phone], (err, result) => {
                    if (err) throw err;
                    res.writeHead(200, { 'Content-Type': 'text/plain' });
                    res.end('User registered successfully');
                });
            } else {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('Not Found');
            }
        } catch (err) {
            console.error('SQL error:', err);
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Internal Server Error');
        } finally {
            //connection.end();
        }
    });
});

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

mqttClient.subscribe('gate/check');