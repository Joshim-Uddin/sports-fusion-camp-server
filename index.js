const express = require('express');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken')
const SSLCommerzPayment = require('sslcommerz-lts')
require('dotenv').config()
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const port = process.env.PORT || 5000
app.use(express.json())

app.use(cors())




const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.x5isz8r.mongodb.net/?retryWrites=true&w=majority`;
 
const store_id = process.env.STORE_ID
const store_passwd = process.env.STORE_PASS
const is_live = false //true for live, false for sandbox

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

const usersCollection = client.db('sportsfusionDB').collection('users');
const classCollection = client.db('sportsfusionDB').collection('classes');
const selectCollection = client.db('sportsfusionDB').collection('selections');
const enrolledCollection = client.db('sportsfusionDB').collection('enrolled');

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    //await client.connect();

    //JWT verification
    const verifyJwt = (req, res, next)=>{
      const authorization = req.headers.authorization;
      if (!authorization){
        return res.status(401).send({error:true, message: 'Invalid authorization'})
      }
      const token = authorization?.split(' ')[1]
      if(!token){
        return res.status(403).send({error:true, message: 'Invalid token'})
      }
      jwt.verify(token, process.env.JWT_VERIFY_TOKEN, (err, decoded)=>{
        if(err){
         return res.status(403).send({error:true, message:"UnAuthorized Access"})
        } 
        req.decoded = decoded;
        next()
      })
      
    }


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

  //users list
  app.get('/users', async (req, res)=>{
    const result = await usersCollection.find().toArray()
    res.send(result)
  })

  app.get('/classes', async (req, res)=>{
    const result = await classCollection.find().toArray()
    res.send(result)
  })
  app.get('/popularclasses', async (req, res)=>{
    const result = (await classCollection.find().sort({students : -1}).toArray()).slice(0,9);
    res.send(result)
  })
  app.patch('/classes/:id', async (req, res)=>{
    const id = req.params.id;
    const status = req.body.status;
    const filter = {_id: new ObjectId(id)}
    const updateObject = {
      $set:{
        status: status,
      }
    }
    const result = await classCollection.updateOne(filter, updateObject)
    res.send(result)
  })

app.get('/popularinstructor', async(req, res) => {
 const result = await classCollection.aggregate([
  {
    $group:
      /**
       * _id: The id of the group.
       * fieldN: The first field name.
       */
      {
        _id: "$email",
        studentsCount: {
          $sum: "$students",
        },
      },
  },
  {
    $sort: {
      studentCount: -1,
    },
  },
  {
    $lookup:
      /**
       * from: The target collection.
       * localField: The local join field.
       * foreignField: The target join field.
       * as: The name for the results.
       * pipeline: Optional pipeline to run on the foreign collection.
       * let: Optional variables to use in the pipeline field stages.
       */
      {
        from: "users",
        localField: "_id",
        foreignField: "email",
        as: "instructorDetails",
      },
  },
  {
    $unwind:
      /**
       * path: Path to the array field.
       * includeArrayIndex: Optional name for index.
       * preserveNullAndEmptyArrays: Optional
       *   toggle to unwind null and empty values.
       */
      {
        path: "$instructorDetails",
      },
  },
  {
    $project:
      /**
       * specifications: The fields to
       *   include or exclude.
       */
      {
        _id: 0,
        name: "$instructorDetails.name",
        instructorEmail:
          "$instructorDetails.email",
        instructorImage:
          "$instructorDetails.image",
        instructorRole: "$instructorDetails.role",
      },
  },
]).toArray()
res.send(result.slice(0,6))
})

  app.get('/instructorclasses', async(req, res)=>{
    //const decoded = req.decoded;
    const email = req.query.email;
    // if(decoded.email!==email){
    //   return res.status(403).send({error:1, message: "Forbidden Access"});
    // }
    const query = {email: email}
    const result = await classCollection.find(query).toArray()
    res.send(result)
  })
  app.get('/selectclass', verifyJwt, async (req, res) => {
    const decoded = req.decoded;
    const email = req.query.email;
    const query = {email:email}
    if(decoded.email!==email){
      return res.status(403).send({error:1, message: "Forbidden Access"});
    }
      const result = await selectCollection.find(query).toArray();
      res.send(result)
  })
  app.get('/enrolledclass', verifyJwt, async (req, res) => {
    const decoded = req.decoded;
    const email = req.query.email;
    if(decoded?.email!==email){
      return res.status(403).send({error:true, message: "Forbidden Access"});
    }
    const query = {email:email}
    const result = await enrolledCollection.find(query).toArray();
    res.send(result)
  })

  app.post('/adduser', async (req, res)=>{
        const user = req.body;
        const query = {email: user.email}
        const existing = await usersCollection.findOne(query)
        if(existing){
          return
        }
        const result = await usersCollection.insertOne(user)
        res.send(result)
      })
  app.post('/addclass', async (req, res) => {
        const myClass = req.body;
       const result = await classCollection.insertOne(myClass)
       res.send(result)
      })
  app.post('/selectclass', async (req, res) => {
        const selected = req.body;
        const query = {classId: selected.classId, email: selected.email}
        const existing = await selectCollection.findOne(query)
        if(existing){
          return res.send({status:'Failed'})
        }else{
          const result = await selectCollection.insertOne(selected)
          res.send(result)
        }
      
      })

  //create intent for stripe
  app.post('/create-payment-intent', async (req, res) => {
    const {price} = req.body;
    const amount = parseInt(price * 100)
    const paymentIntent= await stripe.paymentIntents.create({
      amount: amount,
      currency: 'usd',
      payment_method_types:[
        'card'
      ]
    })
    res.send({
      client_secret: paymentIntent.client_secret
    })
  })
  const trans_Id = new ObjectId().toString()

  app.post('/enroll', async (req, res) =>{
    const item = req.body
    const id = item._id
    const query = {_id: new ObjectId(id)}
    const product = await selectCollection.findOne(query)
    console.log(product);
    const updateDoc = {
      $set:{seats:product.seats - 1, students:product.students + 1}
    }
    const deleted = await selectCollection.deleteOne(query)
    const updatedClasses = await classCollection.updateOne({_id:new ObjectId(product.classId)}, updateDoc)

    const data = {
      total_amount: product.price,
      currency: 'BDT',
      tran_id: trans_Id, // use unique tran_id for each api call
      success_url: `https://b7a12-summer-camp-server-side-joshim-uddin-joshim-uddin.vercel.app/success/${trans_Id}`,
      fail_url: `https://b7a12-summer-camp-server-side-joshim-uddin-joshim-uddin.vercel.app/fail/${trans_Id}`,
      cancel_url: 'http://localhost:3030/cancel',
      ipn_url: 'http://localhost:3030/ipn',
      shipping_method: 'Courier',
      product_name: 'Computer.',
      product_category: 'Electronic',
      product_profile: 'general',
      cus_name: 'Customer Name',
      cus_email: product.email,
      cus_add1: 'Dhaka',
      cus_add2: 'Dhaka',
      cus_city: 'Dhaka',
      cus_state: 'Dhaka',
      cus_postcode: '1000',
      cus_country: 'Bangladesh',
      cus_phone: '01711111111',
      cus_fax: '01711111111',
      ship_name: 'Customer Name',
      ship_add1: 'Dhaka',
      ship_add2: 'Dhaka',
      ship_city: 'Dhaka',
      ship_state: 'Dhaka',
      ship_postcode: 1000,
      ship_country: 'Bangladesh',
  };
  const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live)
  sslcz.init(data).then(apiResponse => {
      // Redirect the user to payment gateway
      let GatewayPageURL = apiResponse.GatewayPageURL
      res.send({url:GatewayPageURL})
    const finalOrder = {
      name: product.className,
      image:product.classImage,
      instructor: product.instructorName,
      transactionId: trans_Id, 
      email: product.email,
      classId: new ObjectId(`${product.classId}`),
      paidAmount: product.price,
      paidStatus: false
    }
   
      const result = enrolledCollection.insertOne(finalOrder)
   
    

  });
  })
  app.post('/success/:transId', async(req, res)=>{
    const query = {transactionId: req.params.transId}
    const updateDoc = {
      $set :{
        paidStatus: true,
      }
    }
    const result = await enrolledCollection.updateOne(query, updateDoc)
    if(result.modifiedCount>0){
      setTimeout(() =>{
        res.redirect("https://sports-fushion-camp-a87dd.web.app/dashboard/selected")
      },5000)
    }

  })
  app.delete('/fail:transId', async(req, res)=>{
    const query = {transactionId: req.params.transId}
    const result = await enrolledCollection.deleteOne(query)
  })
  app.put('/updateuser', async(req, res) => {
    const email = req.query.email;
        const role = req.body.role;
        const filter = {
          email: email
        }
        const updateDoc = {
          $set:{
            role: role
          }
        }

         const result  = await usersCollection.updateOne(filter, updateDoc)
         res.send(result);
      })

  app.delete('/selectclass/:id', async (req, res) => {
        const id = req.params.id
        const query = {_id:new ObjectId(id)}
       const result = await selectCollection.deleteOne(query);
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