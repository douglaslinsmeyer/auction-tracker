/**
 * Safe math operations for financial calculations
 * Prevents integer overflow and handles currency properly
 */

const MAX_SAFE_BID = 999999; // $999,999 maximum bid
const MIN_BID = 1; // $1 minimum

class SafeMath {
  /**
   * Safely add two monetary values
   * @param {number} a - First amount
   * @param {number} b - Second amount
   * @returns {number} Sum or MAX_SAFE_BID if overflow
   */
  static addMoney(a, b) {
    // Ensure inputs are numbers
    const numA = Number(a) || 0;
    const numB = Number(b) || 0;
    
    // Check for overflow before addition
    if (numA > MAX_SAFE_BID - numB) {
      return MAX_SAFE_BID;
    }
    
    const result = numA + numB;
    
    // Ensure result is within bounds
    return Math.min(Math.max(result, MIN_BID), MAX_SAFE_BID);
  }

  /**
   * Calculate next bid amount safely
   * @param {number} currentBid - Current bid amount
   * @param {number} increment - Bid increment
   * @param {number} buffer - Additional buffer amount
   * @returns {number} Safe next bid amount
   */
  static calculateNextBid(currentBid, increment = 5, buffer = 0) {
    // Validate inputs
    const safeCurrent = this.validateBidAmount(currentBid);
    const safeIncrement = Math.max(0, Math.min(Number(increment) || 5, 1000));
    const safeBuffer = Math.max(0, Math.min(Number(buffer) || 0, 100));
    
    // Calculate minimum required bid
    const minimumBid = this.addMoney(safeCurrent, safeIncrement);
    
    // Add buffer if specified
    return this.addMoney(minimumBid, safeBuffer);
  }

  /**
   * Validate and sanitize bid amount
   * @param {number} amount - Bid amount to validate
   * @returns {number} Valid bid amount
   */
  static validateBidAmount(amount) {
    const num = Number(amount);
    
    // Check for invalid values
    if (!Number.isFinite(num) || Number.isNaN(num)) {
      throw new Error('Invalid bid amount');
    }
    
    // Round to nearest dollar (no cents)
    const rounded = Math.round(num);
    
    // Ensure within bounds
    if (rounded < MIN_BID) {
      throw new Error(`Bid amount must be at least $${MIN_BID}`);
    }
    
    if (rounded > MAX_SAFE_BID) {
      throw new Error(`Bid amount cannot exceed $${MAX_SAFE_BID.toLocaleString()}`);
    }
    
    return rounded;
  }

  /**
   * Check if bid is within budget
   * @param {number} bidAmount - Proposed bid
   * @param {number} maxBid - Maximum allowed bid
   * @returns {boolean} True if within budget
   */
  static isWithinBudget(bidAmount, maxBid) {
    try {
      const safeBid = this.validateBidAmount(bidAmount);
      const safeMax = this.validateBidAmount(maxBid);
      return safeBid <= safeMax;
    } catch (error) {
      return false;
    }
  }

  /**
   * Calculate percentage of max bid used
   * @param {number} currentBid - Current bid amount
   * @param {number} maxBid - Maximum bid amount
   * @returns {number} Percentage (0-100)
   */
  static calculateBidPercentage(currentBid, maxBid) {
    try {
      const safeCurrent = this.validateBidAmount(currentBid);
      const safeMax = this.validateBidAmount(maxBid);
      
      if (safeMax === 0) return 0;
      
      return Math.round((safeCurrent / safeMax) * 100);
    } catch (error) {
      return 0;
    }
  }

  /**
   * Format currency for display (still returns number)
   * @param {number} amount - Amount to format
   * @returns {number} Formatted amount
   */
  static formatCurrency(amount) {
    try {
      return this.validateBidAmount(amount);
    } catch (error) {
      return 0;
    }
  }

  /**
   * Parse currency string to number
   * @param {string} currencyStr - Currency string (e.g., "$1,234.56")
   * @returns {number} Parsed amount
   */
  static parseCurrency(currencyStr) {
    if (typeof currencyStr !== 'string') {
      return this.validateBidAmount(currencyStr);
    }
    
    // Remove currency symbols and commas
    const cleaned = currencyStr.replace(/[$,]/g, '').trim();
    const parsed = parseFloat(cleaned);
    
    return this.validateBidAmount(parsed);
  }
}

module.exports = SafeMath;