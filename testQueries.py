import json
import requests
import pprint
postURL = 'http://localhost:3000/posts'
productURL = 'http://localhost:3000/products'
dataPost = {
  'picture': 'https://s-media-cache-ak0.pinimg.com/474x/1a/eb/2e/1aeb2eff3242f5884a8a23e4bdb7946f.jpg',
  'description': 'Marcos favorite outfit',
  'tags': [1,2],
  'brands': [1,2],
  'products': [1,2,3,4],
  'UserId': 1
}

dataProduct =  {
  'displayName': 'Nike Shoes',
  'picture':  'https://s-media-cache-ak0.pinimg.com/474x/51/80/00/5180009b176132bba9729c0f910b4bd7.jpg',
  'BrandId': 1
}

headers = {'Content-type': 'application/json'}

data_json = json.dumps(dataPost)
response = requests.post(postURL, data=data_json, headers=headers)

data_json = json.dumps(dataProduct)
response = requests.post(productURL, data=data_json, headers=headers)

