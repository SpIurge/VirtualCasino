import express from 'express';
import mysql from 'mysql2/promise';
import 'dotenv/config';
import session from 'express-session';

const app = express();

// Session configuration
app.set('trust proxy', 1) // trust first proxy
app.use(session({
  secret: 'cst336 csumb',
  resave: false,
  saveUninitialized: true,
  // cookie: { secure: true } // Only works in web servers
}))

app.set('view engine', 'ejs');
app.use(express.static('public'));

//for Express to get values using the POST method
app.use(express.urlencoded({extended:true}));

//setting up database connection pool
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DATABASE,
    connectionLimit: 10,
    waitForConnections: true
});

//routes
app.get('/', (req, res) => {
    res.send('Hello Express app!');
});

app.get('/blackjack', (req, res) => {
    res.render('blackjack.ejs');
});

app.get("/dbTest", async(req, res) => {
   try {
        const [rows] = await pool.query("SELECT CURDATE()");
        res.send(rows);
    } catch (err) {
        console.error("Database error:", err);
        res.status(500).send("Database error!");
    }
});//dbTest

app.listen(3000, ()=>{
    console.log("Express server running")
})
