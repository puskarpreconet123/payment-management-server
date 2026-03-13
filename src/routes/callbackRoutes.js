
const express = require('express');
const router = express.Router();
const { rupeeFlowCallback, cgpeyCallback } = require('../controllers/callbackController');

router.post('/rupeeflow', rupeeFlowCallback);
router.post('/cgpey', cgpeyCallback);

router.post('/', async (req, res) => {
  console.log("callback came form paynexa", req.body)
})

module.exports = router;