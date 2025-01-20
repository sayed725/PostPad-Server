const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config()
const jwt = require('jsonwebtoken');
const port = process.env.PORT || 5001





// middle ware 
app.use(cors());
app.use(express.json());



const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.nb52s.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const userCollection = client.db("postPasDb").collection("users");
    const tagCollection = client.db("postPasDb").collection("tags");
    const postCollection = client.db("postPasDb").collection("posts");

     // jwt related api
     app.post('/jwt', async (req, res) => {
        const user = req.body;
        const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '24h' });
        res.send({ token });
      })

       // middlewares 
    const verifyToken = (req, res, next) => {
        // console.log('inside verify token', req.headers.authorization);
        if (!req.headers.authorization) {
          return res.status(401).send({ message: 'unauthorized access' });
        }
        const token = req.headers.authorization.split(' ')[1];
        jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
          if (err) {
            return res.status(401).send({ message: 'unauthorized access' })
          }
          req.decoded = decoded;
          next();
        })
      }

       // use verify admin after verifyToken
    const verifyAdmin = async (req, res, next) => {
        const email = req.decoded.email;
        const query = { email: email };
        const user = await userCollection.findOne(query);
        const isAdmin = user?.role === 'admin';
        if (!isAdmin) {
          return res.status(403).send({ message: 'forbidden access' });
        }
        next();
      }

       // users related api
    app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
        const result = await userCollection.find().toArray();
        res.send(result);
      });

    //   make admin 
    app.patch('/users/admin/:id', verifyToken, verifyAdmin, async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updatedDoc = {
          $set: {
            role: 'admin'
          }
        }
        const result = await userCollection.updateOne(filter, updatedDoc);
        res.send(result);
      })

    //   delete user
    app.delete('/users/:id', verifyToken, verifyAdmin, async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) }
        const result = await userCollection.deleteOne(query);
        res.send(result);
      })


  
      app.get('/users/admin/:email', verifyToken, async (req, res) => {
        const email = req.params.email;
  
        if (email !== req.decoded.email) {
          return res.status(403).send({ message: 'forbidden access' })
        }
  
        const query = { email: email };
        const user = await userCollection.findOne(query);
        let admin = false;
        if (user) {
          admin = user?.role === 'admin';
        }
        res.send({ admin });
      })

    //   member or not verify 
      app.get('/users/member/:email', verifyToken, async (req, res) => {
        const email = req.params.email;
  
        if (email !== req.decoded.email) {
          return res.status(403).send({ message: 'forbidden access' })
        }
  
        const query = { email: email };
        const user = await userCollection.findOne(query);
        let member = false;
        if (user) {
          member = user?.role === 'gold';
        }
        res.send({ member });
      })




    app.post('/users', async (req, res) => {
        const user = req.body;
        // insert email if user not exists: 
        const query = { email: user.email }
        const existingUser = await userCollection.findOne(query);
        if (existingUser) {
          return res.send({ message: 'user already exists', insertedId: null })
        }
        const result = await userCollection.insertOne(user);
        res.send(result);
      });
  








    //  admin related api 

    // add tags 
    app.post('/tags',verifyToken, verifyAdmin,async(req,res)=>{
        const { tagname } = req.body
        const existingTag = await tagCollection.findOne({ tagname });
        if (existingTag) {
            return res.send({ message: 'tag already exists' })
          }
        const result = await tagCollection.insertOne({tagname})
        res.send(result)
    })

   

    app.get('/tags',async(req,res)=>{
        const result = await tagCollection.find().toArray();
        res.send(result);
    })



    // user post related api 

    // add a post 

    app.get('/posts', async (req, res) => {
        const search = req.query.search;
       

        let query = {
            usedTag: {
              $regex: search,
              $options: 'i',
            }}
        const result = await postCollection.find(query).sort({ time: -1 }).toArray();
        res.send(result);
      });

     app.get('/posts/:id',async(req,res)=>{
        const id = req.params.id
        const query = { _id: new ObjectId(id) }
        const result = await postCollection.findOne(query)
        res.send(result)
     }) 
  


    app.post('/add-post', verifyToken, async (req, res) => {
        const post= req.body;
        const result = await postCollection.insertOne(post);
        res.send(result);
      });


    //   add vpvote 

    // app.put('/post/upvote', async(req,res)=>{
    //     const postId = new ObjectId(req.body._id);
    //     await postCollection.updateOne(
    //         { _id: postId },
    //         { $inc: { upVote: 1 } } // Increment downvote count by 1
    //     );

    //     const result = await postCollection.findOne({ _id: postId })
    //     res.send(result)
    // })

    //  add upvote 
    app.put('/post/upvote', async(req,res)=>{
       const id = req.body._id
    //    console.log(id)
       const filter = { _id: new ObjectId(id) }


       const updatedDoc = {
        $inc: { upVote: 1}
       }
       const result = await postCollection.updateOne(filter, updatedDoc);

        res.send(result)
    })

    // add dawn vote 
    app.put('/post/dawnvote', async(req,res)=>{
       const id = req.body._id
    //    console.log(id)
       const filter = { _id: new ObjectId(id) }


       const updatedDoc = {
        $inc: { dawnVote: 1}
       }
       const result = await postCollection.updateOne(filter, updatedDoc);

        res.send(result)
    })











    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);



app.get('/',(req,res)=>{
    res.send('post pad is running')
})

app.listen(port, ()=>{
    console.log(`Post pad is running on port ${port}`);
} )