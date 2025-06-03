// --- Part 1: Get the TextSplitter instance ---
// Your 'ai_textSplitter' input pin is named "input" in your node's JSON configuration.
// We use its TYPE for getInputConnectionData.
console.log("Attempting to retrieve TextSplitter instance via this.getInputConnectionData('ai_textSplitter', 0)");
const receivedSplitterData = await this.getInputConnectionData('ai_textSplitter', 0);
let textSplitterInstance;

if (Array.isArray(receivedSplitterData) && receivedSplitterData.length > 0) {
    const potentialInstance = receivedSplitterData[0];
    if (potentialInstance && typeof potentialInstance.createDocuments === 'function') {
        textSplitterInstance = potentialInstance;
        console.log("Successfully retrieved TextSplitter instance. Type:", textSplitterInstance.constructor ? textSplitterInstance.constructor.name : typeof textSplitterInstance);
    }
}

if (!textSplitterInstance) {
    console.error("Failed to retrieve a valid TextSplitter instance from 'ai_textSplitter' connection. Data received:", receivedSplitterData);
    throw new Error('Could not retrieve a valid TextSplitter instance. Ensure "Token Splitter" node is connected to the ai_textSplitter input pin and is providing its instance.');
}

// --- Part 2: Get the main input data (the transcript text) ---
console.log("Attempting to retrieve main data items for splitting...");

// === COMPREHENSIVE INPUT DATA DEBUGGING ===
console.log("=== DEBUGGING INPUT DATA ===");
console.log("this.getInputData type:", typeof this.getInputData);

// Get all input data
const mainInputItems = this.getInputData();

console.log("Raw mainInputItems:", mainInputItems);
console.log("mainInputItems type:", typeof mainInputItems);
console.log("mainInputItems is array:", Array.isArray(mainInputItems));
console.log("mainInputItems length:", mainInputItems ? mainInputItems.length : 'null/undefined');

// Detailed analysis of input structure
if (mainInputItems && Array.isArray(mainInputItems) && mainInputItems.length > 0) {
    console.log("=== ANALYZING FIRST ITEM ===");
    const firstItem = mainInputItems[0];
    console.log("First item:", firstItem);
    console.log("First item type:", typeof firstItem);
    console.log("First item keys:", Object.keys(firstItem || {}));
    
    if (firstItem && firstItem.json) {
        console.log("First item JSON data:", firstItem.json);
        console.log("First item JSON keys:", Object.keys(firstItem.json));
        console.log("Available text fields in first item:");
        
        // Check for common text field names
        const textFields = ['data', 'text', 'content', 'document', 'message', 'body', 'description'];
        textFields.forEach(field => {
            if (firstItem.json[field] !== undefined) {
                console.log(`  - ${field}: ${typeof firstItem.json[field]} (length: ${typeof firstItem.json[field] === 'string' ? firstItem.json[field].length : 'N/A'})`);
                if (typeof firstItem.json[field] === 'string' && firstItem.json[field].length < 200) {
                    console.log(`    Preview: "${firstItem.json[field].substring(0, 100)}..."`);
                }
            }
        });
    }
    
    if (firstItem && firstItem.binary) {
        console.log("First item has binary data:", Object.keys(firstItem.binary));
    }
} else {
    console.log("No valid input items found or input is not an array");
}

// Try alternative input methods for debugging
console.log("=== TRYING ALTERNATIVE INPUT METHODS ===");
try {
    const inputData0 = this.getInputData(0);
    console.log("getInputData(0) result:", inputData0);
    console.log("getInputData(0) length:", inputData0 ? inputData0.length : 'null/undefined');
} catch (e) {
    console.log("getInputData(0) error:", e.message);
}

try {
    const inputData1 = this.getInputData(1);
    console.log("getInputData(1) result:", inputData1);
} catch (e) {
    console.log("getInputData(1) error:", e.message);
}

// Check node information
console.log("=== NODE INFORMATION ===");
try {
    const node = this.getNode();
    console.log("Node info:", {
        name: node.name,
        type: node.type,
        typeVersion: node.typeVersion
    });
} catch (e) {
    console.log("Error getting node info:", e.message);
}

console.log("=== END DEBUGGING ===");

// --- Part 3: Process the input data ---
console.log(`Processing ${mainInputItems ? mainInputItems.length : '0'} item(s) from input data...`);

if (!mainInputItems || mainInputItems.length === 0) {
    console.warn("No items received from input. Node will output an empty documents array. Ensure your text data source is connected to this node and is providing data.");
    return []; // Return empty array if no input text
}

const allSplitDocuments = [];

for (let i = 0; i < mainInputItems.length; i++) {
    const item = mainInputItems[i];
    
    if (!item || !item.json) {
        console.warn(`Item ${i} is invalid or missing JSON data. Skipping.`);
        continue;
    }
    
    // Get text content from the item - try multiple common field names
    let textToSplit = '';
    const jsonData = item.json;
    
    // Try common text field names in order of preference
    const textFieldCandidates = ['data', 'text', 'content', 'document', 'message', 'body', 'description'];
    
    for (const fieldName of textFieldCandidates) {
        if (jsonData[fieldName] && typeof jsonData[fieldName] === 'string' && jsonData[fieldName].trim() !== '') {
            textToSplit = jsonData[fieldName];
            console.log(`Item ${i}: Using field '${fieldName}' for text content (length: ${textToSplit.length})`);
            break;
        }
    }
    
    // If no specific text field found, try converting entire JSON to string as fallback
    if (!textToSplit) {
        textToSplit = JSON.stringify(jsonData);
        console.log(`Item ${i}: No specific text field found, using entire JSON as string (length: ${textToSplit.length})`);
    }
    
    // Create metadata for this item
    const sourceMetadata = {
        source: jsonData.source || `input_item_${i}`,
        loaded_at: new Date().toISOString(),
        loader_type: 'custom-code-node-input',
        item_index: i,
        ...jsonData.metadata // Include any existing metadata
    };

    if (typeof textToSplit !== 'string' || textToSplit.trim() === "") {
        console.warn(`Item ${i} (source: ${sourceMetadata.source}) does not contain valid text content. Available fields:`, Object.keys(jsonData), '. Skipping this item.');
        continue;
    }

    console.log(`Processing text from item ${i} (source: ${sourceMetadata.source}, text length: ${textToSplit.length})...`);

    try {
        const documents = await textSplitterInstance.createDocuments([textToSplit], [sourceMetadata]);
        console.log(`Item ${i} (source: ${sourceMetadata.source}): Successfully split into ${documents.length} LangChain Document(s).`);
        allSplitDocuments.push(...documents);
    } catch (error) {
        console.error(`Error during textSplitterInstance.createDocuments() for item ${i} (source: ${sourceMetadata.source}):`, error);
        // Continue processing other items even if one fails
    }
}

console.log(`Total documents created from input data: ${allSplitDocuments.length}`);
return allSplitDocuments;