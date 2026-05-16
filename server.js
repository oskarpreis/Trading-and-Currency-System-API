import express from "express";

const app = express();
app.use(express.json());

const balances = {};
const purchasedLimitedItems = {};

const shops = [
  {
    shopId: "blacksmith_1",
    name: "Ironhand Forge",
    shopType: "blacksmith",
    description: "Schmied mit Waffen und einfacher Ausruestung."
  },
  {
    shopId: "potion_shop_1",
    name: "Moonroot Remedies",
    shopType: "potion_shop",
    description: "Laden fuer Heiltraenke und einfache Alchemie."
  },
  {
    shopId: "general_store_1",
    name: "Mira's General Goods",
    shopType: "general_store",
    description: "Allgemeiner Laden fuer Vorrat und Ausruestung."
  }
];

const shopItems = {
  blacksmith_1: [
    {
      itemId: "iron_sword",
      name: "Iron Sword",
      price: { gold: 1, silver: 20, bronze: 0 },
      category: "weapon",
      limited: false
    },
    {
      itemId: "steel_shield",
      name: "Steel Shield",
      price: { gold: 2, silver: 0, bronze: 0 },
      category: "armor",
      limited: false
    }
  ],
  potion_shop_1: [
    {
      itemId: "minor_healing_potion",
      name: "Minor Healing Potion",
      price: { gold: 0, silver: 25, bronze: 0 },
      category: "potion",
      limited: false
    },
    {
      itemId: "rare_mana_potion",
      name: "Rare Mana Potion",
      price: { gold: 1, silver: 50, bronze: 0 },
      category: "potion",
      limited: true
    }
  ],
  general_store_1: [
    {
      itemId: "rope",
      name: "Rope",
      price: { gold: 0, silver: 5, bronze: 0 },
      category: "supply",
      limited: false
    },
    {
      itemId: "torch_bundle",
      name: "Torch Bundle",
      price: { gold: 0, silver: 2, bronze: 50 },
      category: "supply",
      limited: false
    }
  ]
};

function defaultBalance() {
  return {
    gold: 0,
    silver: 0,
    bronze: 0
  };
}

function toBronze(currency) {
  const gold = currency.gold || 0;
  const silver = currency.silver || 0;
  const bronze = currency.bronze || 0;

  return gold * 10000 + silver * 100 + bronze;
}

function fromBronze(totalBronze) {
  const gold = Math.floor(totalBronze / 10000);
  const afterGold = totalBronze % 10000;
  const silver = Math.floor(afterGold / 100);
  const bronze = afterGold % 100;

  return {
    gold,
    silver,
    bronze
  };
}

function getBalance(characterId) {
  if (!balances[characterId]) {
    balances[characterId] = defaultBalance();
  }

  return balances[characterId];
}

function validateMoney(gold = 0, silver = 0, bronze = 0) {
  return Number.isInteger(gold)
    && Number.isInteger(silver)
    && Number.isInteger(bronze)
    && gold >= 0
    && silver >= 0
    && bronze >= 0;
}

function findShop(shopId) {
  return shops.find(shop => shop.shopId === shopId);
}

function findItem(shopId, itemId) {
  const items = shopItems[shopId] || [];
  return items.find(item => item.itemId === itemId);
}

app.get("/", (req, res) => {
  res.json({
    status: "ok",
    message: "Trading and Currency API is running."
  });
});

app.get("/get-balance", (req, res) => {
  const { characterId } = req.query;

  if (!characterId) {
    return res.status(400).json({
      error: "characterId fehlt."
    });
  }

  res.json({
    characterId,
    balance: getBalance(characterId),
    message: "Geldbestand erfolgreich abgerufen."
  });
});

app.post("/earn-money", (req, res) => {
  const {
    characterId,
    gold = 0,
    silver = 0,
    bronze = 0
  } = req.body;

  if (!characterId) {
    return res.status(400).json({
      error: "characterId fehlt."
    });
  }

  if (!validateMoney(gold, silver, bronze)) {
    return res.status(400).json({
      error: "Gold, Silber und Bronze muessen ganze Zahlen ab 0 sein."
    });
  }

  const current = getBalance(characterId);
  const newTotal = toBronze(current) + toBronze({ gold, silver, bronze });
  const newBalance = fromBronze(newTotal);

  balances[characterId] = newBalance;

  res.json({
    characterId,
    newBalance,
    message: "Geld erfolgreich hinzugefuegt."
  });
});

app.get("/get-shops", (req, res) => {
  res.json({
    shops,
    message: "Shops erfolgreich abgerufen."
  });
});

app.get("/get-shop-items", (req, res) => {
  const { shopId } = req.query;

  if (!shopId) {
    return res.status(400).json({
      error: "shopId fehlt."
    });
  }

  if (!findShop(shopId)) {
    return res.status(404).json({
      error: "Shop nicht gefunden."
    });
  }

  res.json({
    shopId,
    items: shopItems[shopId] || [],
    message: "Shop-Items erfolgreich abgerufen."
  });
});

app.post("/buy-item", (req, res) => {
  const { characterId, shopId, itemId } = req.body;

  if (!characterId || !shopId || !itemId) {
    return res.status(400).json({
      error: "characterId, shopId und itemId sind Pflichtfelder."
    });
  }

  if (!findShop(shopId)) {
    return res.status(404).json({
      error: "Shop nicht gefunden."
    });
  }

  const item = findItem(shopId, itemId);

  if (!item) {
    return res.status(404).json({
      error: "Item nicht gefunden."
    });
  }

  const limitedKey = `${characterId}:${shopId}:${itemId}`;

  if (item.limited && purchasedLimitedItems[limitedKey]) {
    return res.status(400).json({
      error: "Dieses limitierte Item wurde bereits gekauft."
    });
  }

  const currentBalance = getBalance(characterId);
  const currentBronze = toBronze(currentBalance);
  const priceBronze = toBronze(item.price);

  if (currentBronze < priceBronze) {
    return res.status(400).json({
      error: "Nicht genug Geld."
    });
  }

  const newBalance = fromBronze(currentBronze - priceBronze);
  balances[characterId] = newBalance;

  if (item.limited) {
    purchasedLimitedItems[limitedKey] = true;
  }

  res.json({
    characterId,
    newBalance,
    purchasedItem: item,
    message: "Item erfolgreich gekauft."
  });
});

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Trading and Currency API running on port ${port}`);
});
