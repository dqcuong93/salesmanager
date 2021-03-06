var vietnameseSlug = require('vietnamese-slug');
var Sequelize = require('sequelize');
const sequelize = new Sequelize('salesmanagerDB', 'admin', 'Adm!n', {
    host: 'localhost',
    dialect: 'sqlite',

    pool: {
        max: 5,
        min: 0,
        idle: 10000
    },

    // SQLite only
    storage: './database/salesmanager.db'
});

//Change UTC timezone
sequelize.options.timezone = '+07:00';

//Define tables
var invoices = sequelize.define('Invoice', {
    ShippingAddress: {
        type: Sequelize.TEXT
    },
    InvoiceDate: {
        type: Sequelize.DATEONLY
    },
    MoneyReceive: {
        type: Sequelize.TEXT
    }
});
var customers = sequelize.define('Customer', {
    Name: {
        type: Sequelize.TEXT
    },
    Phone: {
        type: Sequelize.TEXT
    },
    Address: {
        type: Sequelize.TEXT
    }
});
var products = sequelize.define('Product', {
    Name: {
        type: Sequelize.TEXT
    },
    Price1: {
        type: Sequelize.INTEGER
    },
    Price2: {
        type: Sequelize.INTEGER
    }
}, {
    timestamps: false
});
var features = sequelize.define('Feature', {
    Type: {
        type: Sequelize.TEXT
    }
}, {
    timestamps: false
});
var invoice_product_feature = sequelize.define('Invoice_Product_Feature', {
    Quantity: {
        type: Sequelize.INTEGER
    }
}, {
    timestamps: false,
    freezeTableName: true
});
var product_feature = sequelize.define('Product_Feature', {
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
    }
}, {
    timestamps: false,
    freezeTableName: true
});
var materials = sequelize.define('Material', {
    Material: {
        type: Sequelize.TEXT
    },
    Quantity: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
    },
    Unit: {
        type: Sequelize.TEXT
    },
    ShopAddress: {
        type: Sequelize.TEXT
    },
    Price: {
        type: Sequelize.DECIMAL,
        allowNull: false,
        defaultValue: 0
    },
    Total: {
        type: Sequelize.DECIMAL
    }
});

//Tables relationship
customers.hasMany(invoices);
invoices.belongsTo(customers);
product_feature.belongsTo(products);
product_feature.belongsTo(features);
products.belongsToMany(features, {
    through: product_feature
});
features.belongsToMany(products, {
    through: product_feature
});
invoice_product_feature.belongsTo(product_feature);
invoice_product_feature.belongsTo(invoices);
product_feature.belongsToMany(invoices, {
    through: invoice_product_feature
});
invoices.belongsToMany(product_feature, {
    through: invoice_product_feature
});

//Add data to tables
var createInvoice = function (requestBody) {
    //Create customer if not exist first, then create invoice
    if (requestBody.name || requestBody.phone) {
        customers.findOrCreate({
            where: {
                Name: requestBody.name,
                Phone: requestBody.phone
            },
            defaults: {
                Address: requestBody.address
            }
        }).spread(function (createdCustomer, created) {
            invoices.create({
                ShippingAddress: requestBody.shipaddress,
                InvoiceDate: requestBody.invoicedate,
                MoneyReceive: requestBody.getmoney,
                CustomerId: createdCustomer.id
            }).then(function (invoice) {
                for (element in requestBody) {
                    if (requestBody[element] === 'Lớn') {
                        productFinder(element, 'Lớn', function (result) {
                            var quantity = requestBody[vietnameseSlug(result.Product.Name).replace('-', '')];
                            if (quantity !== '0' && quantity !== '') {
                                invoice_product_feature.create({
                                    Quantity: quantity,
                                    ProductFeatureId: result.id,
                                    InvoiceId: invoice.id
                                })
                            }
                        })
                    } else if (requestBody[element] === 'Nhỏ') {
                        productFinder(element, 'Nhỏ', function (result) {
                            var quantity = requestBody[vietnameseSlug(result.Product.Name).replace('-', '')];
                            if (quantity !== '0' && quantity !== '') {
                                invoice_product_feature.create({
                                    Quantity: quantity,
                                    ProductFeatureId: result.id,
                                    InvoiceId: invoice.id
                                })
                            }
                        })
                    }
                }
                if (requestBody.yogurt !== '0' && requestBody.yogurt !== '') {
                    productFinder('Yogurt', 'Nhỏ', function (result) {
                        invoice_product_feature.create({
                            Quantity: requestBody.yogurt,
                            ProductFeatureId: result.id,
                            InvoiceId: invoice.id
                        })
                    })
                }
            });
        });
    }
};
var createMaterial = function (requestBody) {
    materials.create({
        Material: requestBody.material,
        Quantity: requestBody.quantity,
        Unit: requestBody.unit,
        ShopAddress: requestBody.shopaddress,
        Price: requestBody.price,
        Total: requestBody.price * requestBody.quantity
    })
};

//DB function
var customerFinder = function (requestBody, callback) {
    var searchstr = requestBody.searchstring.trim();    //trim() to remove spaces
    customers.findAll({
        where: {
            $or: [
                {Name: {$like: '%' + searchstr + '%'}},
                {Phone: {$like: '%' + searchstr + '%'}},
                {Address: {$like: '%' + searchstr + '%'}}
            ]
        }
    }).then(function (customer) {
        callback(JSON.parse(JSON.stringify(customer)));
    });
};
var productFinder = function (productName, productFeature, callback) {
    product_feature.findOne({
        attributes: ['id'],
        include: [{
            model: products,
            where: {
                Name: productName
            },
            attributes: ['Name']
        }, {
            model: features,
            where: {
                Type: productFeature
            },
            attributes: []
        }]
    }).then(function (result) {
        callback(JSON.parse(JSON.stringify(result)));
    })
};
var reportByDate = function (requestBody, callback) {
    invoices.findAll({
        where: {
            InvoiceDate: requestBody.reportDate
        },
        attributes: ['id', 'ShippingAddress', 'InvoiceDate', 'MoneyReceive'],
        include: [{
            model: customers,
            attributes: ['Name']
        }, {
            model: product_feature,
            include: [{
                model: products,
                attributes: ['Name', 'Price1', 'Price2']
            }, {
                model: features,
                attributes: ['Type']
            }]
        }]
    }).then(function (invoice) {
        var _invoice = JSON.parse(JSON.stringify(invoice));
        for (var i = 0; i < _invoice.length; i++) {
            var productDetail = _invoice[i]['Product_Features'];
            var totalCost = 0;
            for (var j = 0; j < productDetail.length; j++) {
                if (productDetail[j]['Feature'].Type === 'Lớn') {
                    totalCost += (productDetail[j]['Invoice_Product_Feature'].Quantity * productDetail[j]['Product'].Price2);
                } else if (productDetail[j]['Feature'].Type === 'Nhỏ') {
                    totalCost += (productDetail[j]['Invoice_Product_Feature'].Quantity * productDetail[j]['Product'].Price1);
                }
            }
            _invoice[i].totalCost = (totalCost + 'K');
        }
        callback(_invoice)
    })
};
var listAllProducts = function (callback) {
    products.findAll({
        attributes: ['Name']
    }).then(function (_products) {
        callback(JSON.parse(JSON.stringify(_products)))
    })
};
var invoiceUpdate = function (requestBody, callback) {
    var status;
    if (requestBody.value === '1') {
        status = 'Đã thu'
    } else if (requestBody.value === '2') {
        status = 'Chưa thu'
    }
    if (status) {
        invoices.update({
            MoneyReceive: status
        }, {
            where: {
                id: requestBody.pk
            }
        }).then(function () {
            callback()
        })
    }
};
var materialList = function (callback) {
    materials.findAll().then(function (result) {
        var _result = JSON.parse(JSON.stringify(result));
        for (i = 0; i < _result.length; i++) {
            _result[i]['createdAt'] = _result[i]['createdAt'].replace(/T/, ' ').replace(/\..+/, '');
        }
        callback(_result)
    })
};
var listAllInvoiceHaventTakenMoney = function (callback) {
    invoices.findAll({
        where: {
            MoneyReceive: 'Chưa thu'
        },
        attributes: ['id', 'InvoiceDate', 'MoneyReceive'],
        include: [{
            model: customers,
            attributes: ['id', 'Name', 'Phone']
        }]
    }).then(function (result) {
        var _invoices = JSON.parse(JSON.stringify(result));
        callback(_invoices)
    })
};

//Manual run at frist time
var productFeatureData = function () {
    products.findAll()
        .then(function (_products) {
            var product = JSON.parse(JSON.stringify(_products));
            features.findAll()
                .then(function (_features) {
                    var feature = JSON.parse(JSON.stringify(_features));
                    for (i in _products) {
                        for (j in _features) {
                            product_feature.create({
                                ProductId: product[i].id,
                                FeatureId: feature[j].id
                            })
                        }
                    }
                })
        })
};

//Exports
exports.sync = function () {
    sequelize.sync({force: false}).then(function () {
        console.log('Sync completed');
        // productFeatureData();
    });
};
exports.authenticateConnection = function () {
    sequelize
        .authenticate()
        .then(function () {
            console.log('Connection has been established successfully.');
        })
        .catch(function (err) {
            console.error('Unable to connect to the database:', err);
        });
};
exports.createInvoice = createInvoice;
exports.customerFinder = customerFinder;
exports.createMaterial = createMaterial;
exports.reportByDate = reportByDate;
exports.listAllProducts = listAllProducts;
exports.invoiceUpdate = invoiceUpdate;
exports.materialList = materialList;
exports.listAllInvoiceHaventTakenMoney = listAllInvoiceHaventTakenMoney;