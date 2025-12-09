import express from 'express';
import mysql from 'mysql2/promise';
const app = express();
app.set('view engine', 'ejs');
app.use(express.static('public'));
//for Express to get values using the POST method
app.use(express.urlencoded({extended:true}));
//setting up database connection pool
const pool = mysql.createPool({
    host: "your_hostname",
    user: "your_username",
    password: "your_password",
    database: "your_database",
    connectionLimit: 10,
    waitForConnections: true
});
//routes
app.get('/', (req, res) => {
   res.send('Hello Express app!')
});

app.get('/home',(req,res)=>{
    res.render('home.ejs')
});

app.get("/blackjack", (req, res) => {
  res.render("blackjack.ejs");        
});

app.get("/slotMachine", (req, res) => {
  res.render("slotMachine.ejs");    
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

app.post("/play", async (req,res)=>{
    const game = req.body.gameSelect;

    if(game == "blackjack"){
        res.redirect("/blackjack");
    }
    if(game == "slotMachine"){
        res.redirect("/slotMachine");
    }
})
app.listen(3000, ()=>{
    console.log("Express server running")
})
