const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config()
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
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
    const commentCollection = client.db("postPasDb").collection("comments");
    const reportCollection = client.db("postPasDb").collection("report");
    const announcementCollection = client.db("postPasDb").collection("announcement");

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



    //   add 3 post for a specific user 

    app.get('/post/:email', verifyToken, async (req, res) => {
        const email = req.params.email;
  
        const query = { authorEmail: email };
        const result = await postCollection.find(query).sort({ time: -1 }).limit(3).toArray();
        res.send(result);
      });


    //   all post for the user 


  app.get('/allpost/:email', verifyToken, async (req, res) => {
        const email = req.params.email;
  
        const query = { authorEmail: email };
        const result = await postCollection.find(query).sort({ time: -1 }).toArray();
        res.send(result);
      });

  // post count for a user
  app.get('/postCount/:email', verifyToken, async (req, res) => {
        const email = req.params.email;

        // console.log(email)
  
        const postCount = await postCollection.countDocuments({ authorEmail: email });

        res.send({ postCount });
        
      });


//   delete post 

app.delete('/post/:id', verifyToken, async (req, res) => {
    const id = req.params.id;
    const query = { _id: new ObjectId(id) }
    const result = await postCollection.deleteOne(query);
    res.send(result);
  })








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

    // app.get('/posts', async (req, res) => {
    //     const search = req.query.search;
    //     const page = parseInt(req.query.page);
    //   const size = parseInt(req.query.size);
       

    //     let query = {
    //         usedTag: {
    //           $regex: search,
    //           $options: 'i',
    //         }}
    //     const result = await postCollection.find(query)
    //     .skip(page * size)
    //     .limit(size)   
    //     .sort({ time: -1 }).toArray();
    //     res.send(result);
    //   });



    app.get('/posts', async (req, res) => {
    
        const search = req.query.search || ""; 
        const sort = req.query.sort || "time"; 
        const page = parseInt(req.query.page) || 0; 
        const size = parseInt(req.query.size) || 5; 
    
        //  aggregation pipeline
        const aggregationPipeline = [
        
          {
            $match: {
              usedTag: { $regex: search, $options: "i" } 
            }
          },
          
          {
            $addFields: {
              voteDifference: { $subtract: ["$upVote", "$dawnVote"] }
            }
          },
          
          {
            $sort: sort === "popularity" ? { voteDifference: -1 } : { time: -1 }
          },
         
          {
            $skip: page * size
          },
          {
            $limit: size
          }
        ];
    
       
        const result = await postCollection.aggregate(aggregationPipeline).toArray();
    
        
        res.send(result);
      })



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
    app.put('/post/upvote', verifyToken,async(req,res)=>{
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
    app.put('/post/dawnvote',verifyToken, async(req,res)=>{
       const id = req.body._id
    //    console.log(id)
       const filter = { _id: new ObjectId(id) }


       const updatedDoc = {
        $inc: { dawnVote: 1}
       }
       const result = await postCollection.updateOne(filter, updatedDoc);

        res.send(result)
    })


    // comments related api 

    app.post('/add-comment', verifyToken,async (req, res) => {
        const comment = req.body;
        const result = await commentCollection.insertOne(comment);
        res.send(result);
      });


      app.get('/comments', async (req, res) => {
        const id = req.query.id;

        // console.log(id)
        const query = { postId: id };
        const result = await commentCollection.find(query).sort({ commentTime: -1 }).toArray();
        res.send(result);
      }); 


    //   payment apis 

      // payment intent
      app.post('/create-payment-intent', async (req, res) => {
        const { price } = req.body;
        const amount = parseInt(price * 100);
        // console.log(amount, 'amount inside the intent')
  
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount,
          currency: 'usd',
          payment_method_types: ['card']
        });
  
        res.send({
          clientSecret: paymentIntent.client_secret
        })
      });


     // change user role to member 

     app.patch('/payment/:email', verifyToken, async (req, res) => {
        const email = req.params.email;
        const filter = { email: email };
        const updatedDoc = {
          $set: {
            role: 'gold'
          }
        }
        const result = await userCollection.updateOne(filter, updatedDoc);
        res.send(result);
      })
      

    //   report related api 

    app.post('/report', verifyToken,async(req,res)=>{
        const report = req.body

        // not duplicate report

        const query = { reportCommentId: report.reportCommentId }
        const existingReport = await reportCollection.findOne(query);
        if (existingReport) {
          return res.send({ message: 'Comment Already reported', insertedId: null })
        }


        const result = await reportCollection.insertOne(report);
        res.send(result);

    })


    app.get('/report', verifyToken,verifyAdmin,async(req,res) =>{
        const result = await reportCollection.find().toArray();
        res.send(result);
    })

    // remove a comment 

    app.delete('/remove-comment/:id', verifyToken,verifyAdmin, async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) }
        const result = await commentCollection.deleteOne(query);
        res.send(result);
      })

    app.delete('/remove-report/:id', verifyToken,verifyAdmin, async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) }
        const result = await reportCollection.deleteOne(query);
        res.send(result);
      })

      // remove user 

      app.delete('/remove-user/:email', verifyToken,verifyAdmin, async (req, res) => {
        const email = req.params.email;
        const query = { email: email }
        const result = await userCollection.deleteOne(query);
        res.send(result);
      })

      // announcement related api

      app.post('/add-announcement', verifyToken,verifyAdmin, async (req, res) => {
        const announcement = req.body;
        const result = await announcementCollection.insertOne(announcement);
        res.send(result);
      })

      app.get('/announcement', async (req, res) => {
        const result = await announcementCollection.find().sort({ date: -1 }).toArray();
        res.send(result);
      })

      // pagination 
      app.get('/postsCount', async (req, res) => {
        const count = await postCollection.estimatedDocumentCount();
        res.send({ count });
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