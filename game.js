// --- Configuration ---
const CANVAS_WIDTH = 1000;
const CANVAS_HEIGHT = 700;
const TILE_SIZE = 50;
const FPS = 60;

// Colors (HEX for canvas drawing)
const COLORS = {
    WHITE: '#FFFFFF',
    BLACK: '#000000',
    GREEN: '#009600',
    LIGHT_GREEN: '#00C800',
    BROWN: '#8B4513',
    GREY: '#646464',
    BLUE: '#0000FF',
    RED: '#FF0000',
    YELLOW: '#FFFF00',
    CYAN: '#00FFFF',
    NIGHT_OVERLAY: 'rgba(0, 0, 50, 0.4)' // Dark blue overlay for night
};

// Game Mechanics Constants
const PLAYER_SPEED = 5;
const MAX_HEALTH = 100;
const MAX_HUNGER = 100;
const MAX_COLD = 100;
const HUNGER_DRAIN_RATE = 0.005; // Per frame
const COLD_DRAIN_RATE = 0.01; // Per frame
const COLD_DRAIN_NIGHT_MULTIPLIER = 2.0;
const HEALTH_REGEN_THRESHOLD = 35; 

// --- Resources and Crafting Definitions ---
const RESOURCES_DEF = {
    'wood': { color: COLORS.BROWN, harvestTime: 2 },
    'stone': { color: COLORS.GREY, harvestTime: 3 },
    'berries': { color: COLORS.RED, harvestTime: 1 }
};

const CRAFTING_RECIPES = {
    'campfire': { materials: { 'wood': 10 }, type: 'structure', providesHeat: true },
    'wooden_pickaxe': { materials: { 'wood': 10 }, type: 'tool' },
    'wooden_sword': { materials: { 'wood': 10 }, type: 'weapon' },
};

// --- Game Initialization ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

const statsPanel = document.getElementById('stats-panel');
const inventoryPanel = document.getElementById('inventory-panel');
const craftingPanel = document.getElementById('crafting-panel');

let gameOverFlag = false;

// --- Classes ---

class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.size = TILE_SIZE * 0.8;
        this.health = MAX_HEALTH;
        this.hunger = MAX_HUNGER;
        this.cold = MAX_COLD;
        this.inventory = { 'wood': 0, 'stone': 0, 'berries': 0 };
        this.selectedItem = null;
        this.speed = PLAYER_SPEED;
        this.isNearFire = false;
        this.keys = {};
        this.bindKeyListeners();
    }

    bindKeyListeners() {
        document.addEventListener('keydown', (e) => { this.keys[e.key] = true; });
        document.addEventListener('keyup', (e) => { this.keys[e.key] = false; });
    }

    update(world, structures) {
        // Handle movement
        if (this.keys['ArrowUp'] || this.keys['w']) this.y -= this.speed;
        if (this.keys['ArrowDown'] || this.keys['s']) this.y += this.speed;
        if (this.keys['ArrowLeft'] || this.keys['a']) this.x -= this.speed;
        if (this.keys['ArrowRight'] || this.keys['d']) this.x += this.speed;

        // Keep player within bounds
        this.x = Math.max(0, Math.min(CANVAS_WIDTH - this.size, this.x));
        this.y = Math.max(0, Math.min(CANVAS_HEIGHT - this.size, this.y));

        // Update survival stats
        this.hunger -= HUNGER_DRAIN_RATE;
        this.hunger = Math.max(0, this.hunger);

        let coldRate = COLD_DRAIN_RATE * (world.isNight ? COLD_DRAIN_NIGHT_MULTIPLIER : 1);
        this.isNearFire = this.checkForFireProximity(structures);

        if (this.isNearFire) {
            this.cold += coldRate * 2; // Gain warmth faster near fire
        }
        this.cold -= coldRate;
        this.cold = Math.max(0, Math.min(MAX_COLD, this.cold));

        // Health regeneration/drain
        if (this.hunger > HEALTH_REGEN_THRESHOLD && this.cold > HEALTH_REGEN_THRESHOLD) {
            this.health += 0.01; // Slow regen
        } else {
            this.health -= 0.005; // Drain health if stats low
        }

        this.health = Math.max(0, Math.min(MAX_HEALTH, this.health));

        if (this.health === 0) {
            gameOver();
        }
    }

    checkForFireProximity(structures) {
        for (const structure of structures) {
            if (structure.providesHeat) {
                const dist = Math.sqrt(
                    Math.pow((this.x + this.size/2) - (structure.x + structure.size/2), 2) +
                    Math.pow((this.y + this.size/2) - (structure.y + structure.size/2), 2)
                );
                // Simple radius check
                if (dist < TILE_SIZE * 2) { 
                    return true;
                }
            }
        }
        return false;
    }

    draw(ctx) {
        ctx.fillStyle = COLORS.BLUE;
        ctx.fillRect(this.x, this.y, this.size, this.size);
    }

    harvest(resourceType, amount) {
        this.inventory[resourceType] = (this.inventory[resourceType] || 0) + amount;
        console.log(`Harvested ${amount} ${resourceType}. Total: ${this.inventory[resourceType]}`);
    }

    craft(recipeName, structures) {
        const recipe = CRAFTING_RECIPES[recipeName];
        let canCraft = true;
        for (const material in recipe.materials) {
            if ((this.inventory[material] || 0) < recipe.materials[material]) {
                canCraft = false;
                break;
            }
        }
        
        if (canCraft) {
            for (const material in recipe.materials) {
                this.inventory[material] -= recipe.materials[material];
            }
            console.log(`Crafted ${recipeName}!`);
            if (recipe.type === 'structure') {
                // Place structure near player for simplicity in this demo
                const newStructure = new Structure(this.x + TILE_SIZE, this.y + TILE_SIZE, recipeName);
                structures.push(newStructure);
            } else if (recipe.type === 'tool' || recipe.type === 'weapon') {
                this.selectedItem = recipeName;
            }
        } else {
            console.log(`Cannot craft ${recipeName}. Missing materials.`);
        }
    }
}

class ResourceNode {
    constructor(x, y, resourceType, amount) {
        this.x = x;
        this.y = y;
        this.resourceType = resourceType;
        this.amount = amount;
        this.color = RESOURCES_DEF[resourceType].color;
        this.size = TILE_SIZE;
        this.isDepleted = false;
    }

    draw(ctx) {
        if (!this.isDepleted) {
            ctx.fillStyle = this.color;
            ctx.fillRect(this.x, this.y, this.size, this.size);
        }
    }

    deplete() {
        this.isDepleted = true;
    }
}

class Structure {
    constructor(x, y, structureType) {
        this.x = x;
        this.y = y;
        this.structureType = structureType;
        this.providesHeat = CRAFTING_RECIPES[structureType].providesHeat;
        this.color = this.providesHeat ? COLORS.YELLOW : COLORS.GREY;
        this.size = TILE_SIZE;
    }

    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.size, this.size);
    }
}

class World {
    constructor() {
        this.dayDuration = 2400; // Frames (approx 4 mins at 60fps)
        this.nightDuration = 2400; // Frames
        this.currentFrame = 0;
        this.isNight = false;
        this.baseGroundColor = COLORS.LIGHT_GREEN;
    }

    update() {
        this.currentFrame += 1;
        if (!this.isNight && this.currentFrame >= this.dayDuration) {
            this.isNight = true;
            this.currentFrame = 0;
            console.log("It is now night time!");
        } else if (this.isNight && this.currentFrame >= this.nightDuration) {
            this.isNight = false;
            this.currentFrame = 0;
            console.log("It is now day time!");
        }
    }

    draw(ctx) {
        // Base color is set by CSS body background, but we can overlay darkness
        if (this.isNight) {
            ctx.fillStyle = COLORS.NIGHT_OVERLAY;
            ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        }
    }

    generateResources(resourceNodes) {
        for (let i = 0; i < 50; i++) {
            const x = Math.random() * (CANVAS_WIDTH - TILE_SIZE);
            const y = Math.random() * (CANVAS_HEIGHT - TILE_SIZE);
            const resourceTypes = Object.keys(RESOURCES_DEF);
            const resourceType = resourceTypes[Math.floor(Math.random() * resourceTypes.length)];
            const amount = Math.floor(Math.random() * 15) + 5;
            resourceNodes.push(new ResourceNode(x, y, resourceType, amount));
        }
    }
}

class UI {
    constructor(player) {
        this.player = player;
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Add listeners for harvesting/crafting via simple clicks on the UI if desired
        document.addEventListener('keydown', (e) => {
            if (e.key === 'h') { // 'h' key for harvest
                this.handleHarvest();
            } else if (e.key === 'c') { // 'c' key for a default craft action
                // For this simple demo, we randomly select a craft
                const recipes = Object.keys(CRAFTING_RECIPES);
                if (recipes.length > 0) {
                    player.craft(recipes[Math.floor(Math.random() * recipes.length)], gameStructures);
                }
            }
        });
    }

    handleHarvest() {
        // Check collision with resource nodes
        for (const node of gameResourceNodes) {
            if (!node.isDepleted) {
                // Simple proximity check for harvesting
                const dist = Math.sqrt(
                    Math.pow((this.player.x + this.player.size/2) - (node.x + node.size/2), 2) +
                    Math.pow((this.player.y + this.player.size/2) - (node.y + node.size/2), 2)
                );
                if (dist < TILE_SIZE * 1.5) { 
                    this.player.harvest(node.resourceType, 1);
                    node.amount -= 1;
                    if (node.amount <= 0) {
                        node.deplete();
                    }
                    // Only harvest one node at a time
                    break; 
                }
            }
        }
    }

    update() {
        if (gameOverFlag) return;
        this.drawStats();
        this.drawInventory();
        this.drawCraftingMenu();
    }

    drawStats() {
        let html = '<h3 class="panel">Stats</h3>';
        html += this.getStatHtml('Health', this.player.health, MAX_HEALTH, COLORS.GREEN, COLORS.RED);
        html += this.getStatHtml('Hunger', this.player.hunger, MAX_HUNGER, COLORS.YELLOW, COLORS.BROWN);
        html += this.getStatHtml('Warmth', this.player.cold, MAX_COLD, COLORS.WHITE, COLORS.BLUE);
        statsPanel.innerHTML = html;
    }

    getStatHtml(name, value, max, color1, color2) {
        const percentage = (value / max) * 100;
        return `
            <div class="stat-bar" title="${name}: ${Math.floor(value)}/${max}">
                <div class="stat-fill" style="width: ${percentage}%; background-color: ${percentage > HEALTH_REGEN_THRESHOLD ? color1 : color2};"></div>
            </div>
            <span>${name}: ${Math.floor(value)}</span>
        `;
    }

    drawInventory() {
        let html = '<h3 class="panel">Inventory</h3>';
        for (const item in this.player.inventory) {
            if (this.player.inventory[item] > 0) {
                html += `<div class="inventory-item">${item}: ${this.player.inventory[item]}</div>`;
            }
        }
        if (this.player.selectedItem) {
            html += `<p>Selected: <strong>${this.player.selectedItem}</strong></p>`;
        }
        inventoryPanel.innerHTML = html;
    }

    drawCraftingMenu() {
        let html = '<h3 class="panel">Crafting (Press C for random craft)</h3>';
        for (const recipeName in CRAFTING_RECIPES) {
            html += `<div class="crafting-item">${recipeName}</div>`;
        }
        craftingPanel.innerHTML = html;
    }
}

// --- Game Functions ---

function gameOver() {
    if (gameOverFlag) return;
    gameOverFlag = true;
    console.log("Game Over!");
    alert("Game Over! You died of hunger or cold.");
    // Stop the game loop or reset
    // For this simple demo, we just stop updates
}

function gameLoop() {
    if (gameOverFlag) return;

    // Update game state
    world.update();
    player.update(world, gameStructures);

    // Drawing
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT); // Clear canvas

    // Draw world elements (ground is handled by CSS body background)
    world.draw(ctx); 
    gameResourceNodes.forEach(node => node.draw(ctx));
    gameStructures.forEach(structure => structure.draw(ctx));
    player.draw(ctx);

    // Update UI
    ui.update();

    requestAnimationFrame(gameLoop);
}

// --- Main execution ---
const player = new Player(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
const world = new World();
const ui = new UI(player);
const gameResourceNodes = [];
const gameStructures = [];

world.generateResources(gameResourceNodes);

// Start the game loop
gameLoop();
