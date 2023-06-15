const express = require('express');
const { MongoClient, ServerApiVersion } = require('mongodb');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken')
require('dotenv').config()
const port = process.env.PORT || 5000
app.use(express.json())
app.use(cors())


const verifyJwt = (req, res, next)=>{
    const authorization = req.headers.authorization;
    if (!authorization){
      res.status(401).send({error:true, message: 'Invalid authorization'})
    }
    const token = authorization.split(' ')[1]
    if(!token){
      res.status(403).send({error:true, message: 'Invalid token'})
    }
    jwt.verify(token, process.env.JWT_TOKEN_KEY, (err, decoded)=>{
      if(err){
        res.status(403).send({error:true, message:"UnAuthorized Access"})
      }
      req.decoded = decoded;
      next()
    })
    
  }

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.x5isz8r.mongodb.net/?retryWrites=true&w=majority`;
 

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

const usersCollection = client.db('sportsfusionDB').collection('users');

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
   

     //jwt authentication
     app.post('/jwt', async (req, res)=>{
        const user = req.body;
        const token = jwt.sign(user, process.env.JWT_VERIFY_TOKEN, {expiresIn: '1h'})
        res.send({token})
      })

    //users admin or user role get
    app.get('/user', async(req, res) => {
    const email = req.query.email;
    const query = {
      email: email
    }
     const result  = await usersCollection.findOne(query)
     res.send(result);
  })
  app.get('/users', async (req, res)=>{
    const result = await usersCollection.find().toArray()
    res.send(result)
  })

    app.post('/users', async (req, res)=>{
        const user = req.body;
        const query = {email: user.email}
        const existing = await usersCollection.findOne(query)
        if(existing){
          return
        }
        const result = await usersCollection.insertOne(user)
        res.send(result)
      })

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    //await client.close();
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Server is listening')
})

app.listen(port, ()=>{
    console.log(`server listening on port ${port}`)
})