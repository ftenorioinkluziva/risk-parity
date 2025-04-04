import React, { useState, useEffect } from 'react';

const TransactionManager = () => {
  // State for transactions and assets
  const [transactions, setTransactions] = useState([]);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // Form state
  const [formVisible, setFormVisible] = useState(false);
  const [formData, setFormData] = useState({
    type: 'buy',
    ativo_id: '',
    quantity: '',
    price: '',
    date: new Date().toISOString().split('T')[0]
  });
  
  // Tab state
  const [activeTab, setActiveTab] = useState('portfolio');
  
  // API URL
  const API_URL = 'http://localhost:5000/api';

  // Fetch assets when component mounts
  useEffect(() => {
    const fetchAssets = async () => {
      setLoading(true);
      try {
        const response = await fetch(`${API_URL}/ativos`);
        
        if (!response.ok) {
          throw new Error(`Failed with status: ${response.status}`);
        }
        
        const data = await response.json();
        setAssets(data);
        setError(null);
      } catch (err) {
        console.error('Error fetching assets:', err);
        setError('Failed to load assets. Please check your connection.');
      } finally {
        setLoading(false);
      }
    };

    fetchAssets();
  }, []);

  // Fetch transactions after assets are loaded
  useEffect(() => {
    if (assets.length === 0) return;
    
    const fetchTransactions = async () => {
      setLoading(true);
      try {
        const response = await fetch(`${API_URL}/transacoes`);
        
        if (!response.ok) {
          throw new Error(`Failed with status: ${response.status}`);
        }
        
        const data = await response.json();
        setTransactions(data);
        setError(null);
      } catch (err) {
        console.error('Error fetching transactions:', err);
        setError('Failed to load transactions.');
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, [assets]);

  // Format currency
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', { 
      style: 'currency', 
      currency: 'BRL' 
    }).format(value);
  };
  
  // Calculate portfolio based on transactions
  const calculatePortfolio = () => {
    const portfolio = {};


    const sortedTransactions = [...transactions].sort((a, b) => 
      new Date(a.date) - new Date(b.date)
    );

    
    // Process each transaction
    sortedTransactions.forEach(transaction => {
      const ativoId = transaction.ativo_id;
      const asset = assets.find(a => a.id === ativoId);
      
      if (!asset) return; // Skip if asset not found
      
      if (!portfolio[ativoId]) {
        portfolio[ativoId] = {
          ativo_id: ativoId,
          asset,
          quantity: 0,
          totalInvestment: 0,
          averagePrice: 0
        };
      }
      
      const assetData = portfolio[ativoId];
      
      if (transaction.type === 'buy') {
        // For buys, update average price and add to quantity
        const oldValue = assetData.quantity * assetData.averagePrice;
        const newValue = transaction.quantity * transaction.price;
        const newQuantity = assetData.quantity + Number(transaction.quantity);
        
        assetData.averagePrice = newQuantity > 0 ? (oldValue + newValue) / newQuantity : 0;
        assetData.quantity = newQuantity;
        assetData.totalInvestment += Number(transaction.quantity) * transaction.price;
      } else if (transaction.type === 'sell') {
        // For sells, reduce quantity
        assetData.quantity -= Number(transaction.quantity);
        
        // Adjust invested value proportionally
        if (assetData.quantity > 0) {
          assetData.totalInvestment = assetData.quantity * assetData.averagePrice;
        } else {
          assetData.quantity = 0;
          assetData.totalInvestment = 0;
        }
      }
      
      // Calculate current value and profit
      assetData.currentPrice = asset.preco_atual;
      assetData.currentValue = assetData.quantity * assetData.currentPrice;
      assetData.profit = assetData.currentValue - assetData.totalInvestment;
      assetData.profitPercentage = assetData.totalInvestment > 0 
        ? (assetData.profit / assetData.totalInvestment) * 100 
        : 0;
    });
    
    // Filter assets with quantity > 0
    return Object.values(portfolio).filter(asset => asset.quantity > 0);
  };
  
  // Calculate portfolio totals
  const calculateTotals = (portfolio) => {
    const totalInvestment = portfolio.reduce((sum, asset) => sum + asset.totalInvestment, 0);
    const totalValue = portfolio.reduce((sum, asset) => sum + asset.currentValue, 0);
    const totalProfit = portfolio.reduce((sum, asset) => sum + asset.profit, 0);
    const profitPercentage = totalInvestment > 0 ? (totalProfit / totalInvestment) * 100 : 0;
    
    return { totalInvestment, totalValue, totalProfit, profitPercentage };
  };
  
  // Handle form field changes
  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  // Add new transaction
  const handleAddTransaction = async () => {
    // Basic validation
    if (!formData.ativo_id || !formData.quantity || !formData.price || !formData.date) {
      setError('Please fill in all fields');
      return;
    }
    
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/transacoes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed with status: ${response.status}`);
      }
      
      const newTransaction = await response.json();
      
      // Add the new transaction to state
      setTransactions([...transactions, newTransaction]);
      
      // Show success message
      setSuccess('Transaction added successfully!');
      setTimeout(() => setSuccess(null), 3000);
      
      // Reset form
      setFormData({
        type: 'buy',
        ativo_id: '',
        quantity: '',
        price: '',
        date: new Date().toISOString().split('T')[0]
      });
      
      // Hide form
      setFormVisible(false);
      
      setError(null);
    } catch (err) {
      console.error('Error adding transaction:', err);
      setError(err.message || 'Failed to add transaction');
    } finally {
      setLoading(false);
    }
  };
  
  // Calculate current portfolio
  const portfolio = calculatePortfolio();
  const totals = calculateTotals(portfolio);
  
  return (
    <div className="bg-white rounded-lg shadow-md">
      <div className="border-b border-gray-200 p-4">
        <h2 className="text-2xl font-semibold text-gray-800">Transaction Manager</h2>
        <p className="text-gray-600">Track your investment portfolio</p>
      </div>
      
      {/* Error and success messages */}
      {error && (
        <div className="m-4 bg-red-100 border-l-4 border-red-500 text-red-700 p-4">
          <p>{error}</p>
        </div>
      )}
      
      {success && (
        <div className="m-4 bg-green-100 border-l-4 border-green-500 text-green-700 p-4">
          <p>{success}</p>
        </div>
      )}
      
      {/* Navigation tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex">
          <button 
            className={`px-4 py-2 border-b-2 font-medium text-sm ${
              activeTab === 'portfolio'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('portfolio')}
          >
            Portfolio
          </button>
          <button 
            className={`px-4 py-2 border-b-2 font-medium text-sm ${
              activeTab === 'transactions'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('transactions')}
          >
            Transactions
          </button>
        </nav>
      </div>
      
      <div className="p-4">
        {/* Loading indicator */}
        {loading && (
          <div className="flex justify-center items-center h-12 mb-4">
            <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-500"></div>
            <span className="ml-2 text-blue-500">Loading...</span>
          </div>
        )}
        
        {/* New transaction button */}
        <div className="mb-4 flex justify-end">
          <button 
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            onClick={() => setFormVisible(!formVisible)}
            disabled={loading}
          >
            {formVisible ? 'Cancel' : 'New Transaction'}
          </button>
        </div>
        
        {/* Transaction form */}
        {formVisible && (
          <div className="mb-6 bg-gray-50 p-4 rounded-lg border border-gray-200">
            <h3 className="text-lg font-medium mb-3">New Transaction</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type <span className="text-red-500">*</span>
                </label>
                <select
                  name="type"
                  value={formData.type}
                  onChange={handleFormChange}
                  className="w-full p-2 border border-gray-300 rounded"
                  disabled={loading}
                >
                  <option value="buy">Buy</option>
                  <option value="sell">Sell</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Asset <span className="text-red-500">*</span>
                </label>
                <select
                  name="ativo_id"
                  value={formData.ativo_id}
                  onChange={handleFormChange}
                  className="w-full p-2 border border-gray-300 rounded"
                  disabled={loading}
                >
                  <option value="">Select an asset</option>
                  {assets.map(asset => (
                    <option key={asset.id} value={asset.id}>
                      {asset.nome} ({asset.ticker})
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quantity <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="quantity"
                  value={formData.quantity}
                  onChange={handleFormChange}
                  className="w-full p-2 border border-gray-300 rounded"
                  placeholder="0"
                  min="0.01"
                  step="0.01"
                  disabled={loading}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Price <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="price"
                  value={formData.price}
                  onChange={handleFormChange}
                  className="w-full p-2 border border-gray-300 rounded"
                  placeholder="0.00"
                  min="0.01"
                  step="0.01"
                  disabled={loading}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  name="date"
                  value={formData.date}
                  onChange={handleFormChange}
                  className="w-full p-2 border border-gray-300 rounded"
                  max={new Date().toISOString().split('T')[0]}
                  disabled={loading}
                />
              </div>
              
              <div className="flex items-end">
                <button
                  className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-green-300"
                  onClick={handleAddTransaction}
                  disabled={loading}
                >
                  {loading ? 'Processing...' : 'Add Transaction'}
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Portfolio tab content */}
        {activeTab === 'portfolio' && (
          <>
            {/* Summary cards */}
            <div className="mb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                <p className="text-sm text-blue-800">Total Value</p>
                <p className="text-2xl font-bold text-blue-900">{formatCurrency(totals.totalValue)}</p>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                <p className="text-sm text-gray-800">Total Invested</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(totals.totalInvestment)}</p>
              </div>
              
              <div className={`p-4 rounded-lg border ${
                totals.totalProfit >= 0 ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'
              }`}>
                <p className={`text-sm ${totals.totalProfit >= 0 ? 'text-green-800' : 'text-red-800'}`}>
                  Profit/Loss
                </p>
                <p className={`text-2xl font-bold ${totals.totalProfit >= 0 ? 'text-green-900' : 'text-red-900'}`}>
                  {formatCurrency(totals.totalProfit)}
                </p>
              </div>
              
              <div className={`p-4 rounded-lg border ${
                totals.profitPercentage >= 0 ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'
              }`}>
                <p className={`text-sm ${totals.profitPercentage >= 0 ? 'text-green-800' : 'text-red-800'}`}>
                  Return
                </p>
                <p className={`text-2xl font-bold ${totals.profitPercentage >= 0 ? 'text-green-900' : 'text-red-900'}`}>
                  {totals.profitPercentage.toFixed(2)}%
                </p>
              </div>
            </div>
            
            {/* Assets table */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Asset</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Price</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Current Price</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Value</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Profit/Loss</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Return %</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {portfolio.length > 0 ? portfolio.map(asset => (
                    <tr key={asset.ativo_id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{asset.asset.nome}</div>
                        <div className="text-xs text-gray-500">{asset.asset.ticker}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-right">
                        {asset.quantity.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-right">
                        {formatCurrency(asset.averagePrice)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-right">
                        {formatCurrency(asset.currentPrice)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-medium">
                        {formatCurrency(asset.currentValue)}
                      </td>
                      <td className={`px-4 py-3 whitespace-nowrap text-sm text-right font-medium ${
                        asset.profit >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {formatCurrency(asset.profit)}
                      </td>
                      <td className={`px-4 py-3 whitespace-nowrap text-sm text-right font-medium ${
                        asset.profitPercentage >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {asset.profitPercentage.toFixed(2)}%
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan="7" className="px-4 py-4 text-center text-gray-500">
                        No assets found. Add transactions to get started.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
        
        {/* Transactions tab content */}
        {activeTab === 'transactions' && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Asset</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Value</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {transactions.length > 0 ? (
                  [...transactions]
                    .sort((a, b) => new Date(b.date) - new Date(a.date))
                    .map(transaction => {
                      const asset = assets.find(a => a.id === transaction.ativo_id);
                      return (
                        <tr key={transaction.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                            {new Date(transaction.date).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              transaction.type === 'buy' 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {transaction.type === 'buy' ? 'Buy' : 'Sell'}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {asset ? (
                              <>
                                <div className="text-sm font-medium text-gray-900">{asset.nome}</div>
                                <div className="text-xs text-gray-500">{asset.ticker}</div>
                              </>
                            ) : (
                              <div className="text-sm text-gray-500">Unknown Asset</div>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-right">
                            {transaction.quantity}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-right">
                            {formatCurrency(transaction.price)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-medium">
                            {formatCurrency(transaction.totalvalue || (transaction.quantity * transaction.price))}
                          </td>
                        </tr>
                      );
                    })
                ) : (
                  <tr>
                    <td colSpan="6" className="px-4 py-4 text-center text-gray-500">
                      No transactions found. Add transactions to get started.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default TransactionManager;