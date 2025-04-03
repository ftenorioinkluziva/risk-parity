import React, { useState, useEffect } from 'react';

const TransactionManager = () => {
  // States for transactions and portfolio
  const [transactions, setTransactions] = useState([]);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // Form states
  const [formVisible, setFormVisible] = useState(false);
  const [formData, setFormData] = useState({
    type: 'buy',
    asset: '',
    quantity: '',
    price: '',
    date: new Date().toISOString().split('T')[0]
  });
  
  // Portfolio calculation
  const [portfolio, setPortfolio] = useState([]);
  const [totals, setTotals] = useState({
    totalInvestment: 0,
    totalValue: 0,
    totalProfit: 0,
    profitPercentage: 0
  });
  
  // Active tab (portfolio or transactions)
  const [activeTab, setActiveTab] = useState('portfolio');

  // API URL
  const API_URL = 'http://localhost:5000/api';

  // Format currency
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', { 
      style: 'currency', 
      currency: 'BRL' 
    }).format(value);
  };

  // Load assets from API
  const fetchAssets = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/ativos`);
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          setAssets(data);
        }
      }
    } catch (err) {
      console.error('Error fetching assets:', err);
      setError('Não foi possível carregar a lista de ativos.');
    } finally {
      setLoading(false);
    }
  };

  // Load transactions from API
  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/transacoes`);
      if (response.ok) {
        const data = await response.json();
        setTransactions(data || []);
        setError(null);
      }
    } catch (err) {
      console.error('Error fetching transactions:', err);
      setError('Erro ao carregar transações. Verifique a conexão com o servidor.');
    } finally {
      setLoading(false);
    }
  };

  // Load portfolio from API
  const fetchPortfolio = async () => {
    try {
      const response = await fetch(`${API_URL}/carteira`);
      if (response.ok) {
        const data = await response.json();
        if (data) {
          setPortfolio(data.ativos || []);
          setTotals({
            totalInvestment: data.totais?.investido || 0,
            totalValue: data.totais?.atual || 0,
            totalProfit: data.totais?.lucro || 0,
            profitPercentage: data.totais?.rendimento || 0
          });
        }
      }
    } catch (err) {
      console.error('Error fetching portfolio:', err);
      // If API fails, calculate portfolio locally
      calculateLocalPortfolio();
    }
  };

  // Calculate portfolio locally if API fails
  const calculateLocalPortfolio = () => {
    const portfolioMap = {};
    
    transactions.forEach(transaction => {
      const { asset, type, quantity, price } = transaction;
      
      if (!portfolioMap[asset]) {
        portfolioMap[asset] = {
          asset,
          quantity: 0,
          totalInvestment: 0,
          averagePrice: 0,
          name: assets.find(a => a.ticker === asset)?.nome || asset
        };
      }
      
      const assetData = portfolioMap[asset];
      
      if (type === 'buy') {
        // Calculate weighted average price
        const oldValue = assetData.quantity * assetData.averagePrice;
        const newValue = parseFloat(quantity) * parseFloat(price);
        const newQuantity = assetData.quantity + parseFloat(quantity);
        
        assetData.averagePrice = newQuantity > 0 ? (oldValue + newValue) / newQuantity : 0;
        assetData.quantity += parseFloat(quantity);
        assetData.totalInvestment += parseFloat(quantity) * parseFloat(price);
      } else { // sell
        assetData.quantity -= parseFloat(quantity);
        
        // Adjust invested value proportionally
        if (assetData.quantity > 0) {
          assetData.totalInvestment = assetData.quantity * assetData.averagePrice;
        } else {
          assetData.quantity = 0;
          assetData.totalInvestment = 0;
        }
      }
      
      // Get current price from assets list
      const assetInfo = assets.find(a => a.ticker === asset);
      if (assetInfo) {
        assetData.currentPrice = assetInfo.preco_atual;
        assetData.currentValue = assetData.quantity * assetData.currentPrice;
        assetData.profit = assetData.currentValue - assetData.totalInvestment;
        assetData.profitPercentage = assetData.totalInvestment > 0 
          ? (assetData.profit / assetData.totalInvestment) * 100 
          : 0;
      }
    });
    
    // Filter assets with quantity > 0
    const portfolioArray = Object.values(portfolioMap).filter(asset => asset.quantity > 0);
    
    // Calculate totals
    const totalInvestment = portfolioArray.reduce((sum, asset) => sum + asset.totalInvestment, 0);
    const totalValue = portfolioArray.reduce((sum, asset) => sum + (asset.currentValue || 0), 0);
    const totalProfit = portfolioArray.reduce((sum, asset) => sum + (asset.profit || 0), 0);
    const profitPercentage = totalInvestment > 0 ? (totalProfit / totalInvestment) * 100 : 0;
    
    setPortfolio(portfolioArray);
    setTotals({
      totalInvestment,
      totalValue,
      totalProfit,
      profitPercentage
    });
  };

  // Save transaction to API
  const saveTransaction = async (transaction) => {
    setFormLoading(true);
    try {
      const response = await fetch(`${API_URL}/transacoes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(transaction),
      });
      
      if (response.ok) {
        const data = await response.json();
        return data;
      }
      throw new Error('Failed to save transaction');
    } catch (err) {
      console.error('Error saving transaction:', err);
      throw err;
    } finally {
      setFormLoading(false);
    }
  };

  // Delete transaction
  const deleteTransaction = async (id) => {
    if (!window.confirm('Tem certeza que deseja excluir esta transação?')) {
      return;
    }
    
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/transacoes/${id}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        setTransactions(transactions.filter(t => t.id !== id));
        setSuccess('Transação excluída com sucesso!');
        setTimeout(() => setSuccess(null), 3000);
        
        // Reload portfolio data
        fetchPortfolio();
      }
    } catch (err) {
      console.error('Error deleting transaction:', err);
      setError('Erro ao excluir transação. Verifique a conexão com o servidor.');
    } finally {
      setLoading(false);
    }
  };

  // Handle form input changes
  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Validate transaction before saving
  const validateTransaction = () => {
    if (!formData.asset || !formData.quantity || !formData.price || !formData.date) {
      setError('Por favor, preencha todos os campos obrigatórios');
      return false;
    }
    
    const quantity = parseFloat(formData.quantity);
    const price = parseFloat(formData.price);
    
    if (isNaN(quantity) || isNaN(price) || quantity <= 0 || price <= 0) {
      setError('Quantidade e preço devem ser valores positivos');
      return false;
    }
    
    // Check if date is in the future
    const transactionDate = new Date(formData.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (transactionDate > today) {
      setError('A data da transação não pode ser no futuro');
      return false;
    }
    
    // If selling, check if user has enough quantity
    if (formData.type === 'sell') {
      const assetInPortfolio = portfolio.find(item => item.asset === formData.asset);
      
      if (!assetInPortfolio) {
        setError(`Você não possui ${formData.asset} para vender`);
        return false;
      }
      
      if (assetInPortfolio.quantity < quantity) {
        setError(`Quantidade insuficiente. Você possui apenas ${assetInPortfolio.quantity.toFixed(2)} unidades de ${formData.asset}`);
        return false;
      }
    }
    
    return true;
  };

  // Add new transaction
  const handleAddTransaction = async () => {
    if (!validateTransaction()) {
      return;
    }
    
    try {
      setFormLoading(true);
      
      const quantity = parseFloat(formData.quantity);
      const price = parseFloat(formData.price);
      
      const newTransaction = {
        type: formData.type,
        asset: formData.asset,
        quantity,
        price,
        date: formData.date,
        totalValue: quantity * price
      };
      
      // Save to API
      const savedTransaction = await saveTransaction(newTransaction);
      
      // Add to local state
      setTransactions(prev => [savedTransaction, ...prev]);
      
      // Show success message
      setSuccess('Transação registrada com sucesso!');
      setTimeout(() => setSuccess(null), 3000);
      
      // Reset form
      setFormData({
        type: 'buy',
        asset: '',
        quantity: '',
        price: '',
        date: new Date().toISOString().split('T')[0]
      });
      
      // Hide form
      setFormVisible(false);
      
      // Clear error
      setError(null);
      
      // Refresh portfolio data
      fetchPortfolio();
    } catch (err) {
      setError('Erro ao processar transação. Por favor, tente novamente.');
    } finally {
      setFormLoading(false);
    }
  };

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      await fetchAssets();
      await fetchTransactions();
      fetchPortfolio();
    };
    
    loadData();
  }, []);

  return (
    <div className="bg-white rounded-lg shadow-md">
      <div className="border-b border-gray-200 p-4">
        <h2 className="text-2xl font-semibold text-gray-800">Gestão de Transações</h2>
        <p className="text-gray-600">Acompanhe sua carteira de investimentos</p>
      </div>
      
      {/* Error and success messages */}
      {error && (
        <div className="m-4 bg-red-100 border-l-4 border-red-500 text-red-700 p-4 flex justify-between items-center">
          <p>{error}</p>
          <button 
            className="text-red-700 font-bold hover:text-red-800 ml-2"
            onClick={() => setError(null)}
          >
            ✕
          </button>
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
            Carteira
          </button>
          <button 
            className={`px-4 py-2 border-b-2 font-medium text-sm ${
              activeTab === 'transactions'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('transactions')}
          >
            Transações
          </button>
        </nav>
      </div>
      
      <div className="p-4">
        {/* Loading indicator */}
        {loading && (
          <div className="flex justify-center items-center h-12 mb-4">
            <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-500"></div>
            <span className="ml-2 text-blue-500">Carregando...</span>
          </div>
        )}
        
        {/* Add transaction button */}
        <div className="mb-4 flex justify-end">
          <button 
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-blue-300"
            onClick={() => setFormVisible(!formVisible)}
            disabled={loading || formLoading}
          >
            {formVisible ? 'Cancelar' : 'Nova Transação'}
          </button>
        </div>
        
        {/* New transaction form */}
        {formVisible && (
          <div className="mb-6 bg-gray-50 p-4 rounded-lg border border-gray-200">
            <h3 className="text-lg font-medium mb-3">Nova Transação</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo <span className="text-red-500">*</span>
                </label>
                <select
                  name="type"
                  value={formData.type}
                  onChange={handleFormChange}
                  className="w-full p-2 border border-gray-300 rounded"
                  disabled={formLoading}
                >
                  <option value="buy">Compra</option>
                  <option value="sell">Venda</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ativo <span className="text-red-500">*</span>
                </label>
                <select
                  name="asset"
                  value={formData.asset}
                  onChange={handleFormChange}
                  className="w-full p-2 border border-gray-300 rounded"
                  disabled={formLoading}
                >
                  <option value="">Selecione um ativo</option>
                  {assets.map(asset => (
                    <option key={asset.id} value={asset.ticker}>
                      {asset.nome}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quantidade <span className="text-red-500">*</span>
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
                  disabled={formLoading}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Preço <span className="text-red-500">*</span>
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
                  disabled={formLoading}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  name="date"
                  value={formData.date}
                  onChange={handleFormChange}
                  className="w-full p-2 border border-gray-300 rounded"
                  max={new Date().toISOString().split('T')[0]}
                  disabled={formLoading}
                />
              </div>
              
              <div className="flex items-end">
                <button
                  className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-green-300"
                  onClick={handleAddTransaction}
                  disabled={formLoading}
                >
                  {formLoading ? 'Processando...' : 'Adicionar'}
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
                <p className="text-sm text-blue-800">Valor Total</p>
                <p className="text-2xl font-bold text-blue-900">{formatCurrency(totals.totalValue)}</p>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                <p className="text-sm text-gray-800">Total Investido</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(totals.totalInvestment)}</p>
              </div>
              
              <div className={`p-4 rounded-lg border ${
                totals.totalProfit >= 0 ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'
              }`}>
                <p className={`text-sm ${totals.totalProfit >= 0 ? 'text-green-800' : 'text-red-800'}`}>
                  Lucro/Prejuízo
                </p>
                <p className={`text-2xl font-bold ${totals.totalProfit >= 0 ? 'text-green-900' : 'text-red-900'}`}>
                  {formatCurrency(totals.totalProfit)}
                </p>
              </div>
              
              <div className={`p-4 rounded-lg border ${
                totals.profitPercentage >= 0 ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'
              }`}>
                <p className={`text-sm ${totals.profitPercentage >= 0 ? 'text-green-800' : 'text-red-800'}`}>
                  Rendimento
                </p>
                <p className={`text-2xl font-bold ${totals.profitPercentage >= 0 ? 'text-green-900' : 'text-red-900'}`}>
                  {totals.profitPercentage.toFixed(2)}%
                </p>
              </div>
            </div>
            
            {/* Portfolio table */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ativo</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Quantidade</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Preço Médio</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Preço Atual</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Valor Total</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Lucro/Prejuízo</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Rendimento</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {portfolio.length > 0 ? portfolio.map(asset => (
                    <tr key={asset.asset} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{asset.name || asset.asset}</div>
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
                        Nenhum ativo encontrado. Adicione transações para começar.
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
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ativo</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Quantidade</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Preço</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Valor Total</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {transactions.length > 0 ? (
                  [...transactions]
                    .sort((a, b) => new Date(b.date) - new Date(a.date))
                    .map(transaction => (
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
                            {transaction.type === 'buy' ? 'Compra' : 'Venda'}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                          {(() => {
                            const asset = assets.find(a => a.ticker === transaction.asset);
                            return asset ? asset.nome : transaction.asset;
                          })()}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-right">
                          {parseFloat(transaction.quantity).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-right">
                          {formatCurrency(transaction.price)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-medium">
                          {formatCurrency(transaction.quantity * transaction.price)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-right">
                          <button
                            onClick={() => deleteTransaction(transaction.id)}
                            className="text-red-600 hover:text-red-900"
                            title="Excluir transação"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))
                ) : (
                  <tr>
                    <td colSpan="7" className="px-4 py-4 text-center text-gray-500">
                      Nenhuma transação encontrada. Adicione transações para começar.
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