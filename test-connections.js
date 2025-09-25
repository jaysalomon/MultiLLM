const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function testOllama() {
  console.log('\n🔍 Testing Ollama connection...');

  try {
    // Check if Ollama is running
    const response = await fetch('http://localhost:11434/api/tags');
    const data = await response.json();

    console.log('✅ Ollama is running!');
    console.log(`Found ${data.models?.length || 0} models:`);

    if (data.models && data.models.length > 0) {
      data.models.forEach(model => {
        console.log(`  - ${model.name} (${(model.size / 1e9).toFixed(1)} GB)`);
      });

      // Test with tinyllama
      console.log('\n📝 Testing chat with tinyllama...');
      const chatResponse = await fetch('http://localhost:11434/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'tinyllama:latest',
          messages: [{ role: 'user', content: 'Say hello in 5 words or less' }],
          stream: false
        })
      });

      const chatData = await chatResponse.json();
      console.log('Response:', chatData.message?.content || 'No response');
    }
  } catch (error) {
    console.error('❌ Ollama connection failed:', error.message);
    console.log('Make sure Ollama is running: ollama serve');
  }
}

async function testLMStudio() {
  console.log('\n🔍 Testing LM Studio connection...');

  try {
    // Check if LM Studio is running
    const response = await fetch('http://localhost:1234/v1/models');
    const data = await response.json();

    console.log('✅ LM Studio is running!');
    console.log(`Found ${data.data?.length || 0} models:`);

    if (data.data && data.data.length > 0) {
      data.data.forEach(model => {
        console.log(`  - ${model.id}`);
      });

      // Test chat completion
      console.log('\n📝 Testing chat completion...');
      const chatResponse = await fetch('http://localhost:1234/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: data.data[0].id,
          messages: [{ role: 'user', content: 'Say hello in 5 words or less' }],
          max_tokens: 50,
          temperature: 0.7
        })
      });

      const chatData = await chatResponse.json();
      console.log('Response:', chatData.choices?.[0]?.message?.content || 'No response');
    }
  } catch (error) {
    console.error('❌ LM Studio connection failed:', error.message);
    console.log('Make sure LM Studio server is running on port 1234');
  }
}

async function testAPIProvider() {
  console.log('\n🔍 Testing API provider setup...');

  try {
    // Test if OpenAI API key is set
    if (process.env.OPENAI_API_KEY) {
      console.log('✅ OpenAI API key found');
    } else {
      console.log('ℹ️  No OpenAI API key set (optional)');
    }

    // Test if Anthropic API key is set
    if (process.env.ANTHROPIC_API_KEY) {
      console.log('✅ Anthropic API key found');
    } else {
      console.log('ℹ️  No Anthropic API key set (optional)');
    }
  } catch (error) {
    console.error('Error checking API providers:', error.message);
  }
}

async function runTests() {
  console.log('====================================');
  console.log('Multi-LLM Chat Connection Tests');
  console.log('====================================');

  await testOllama();
  await testLMStudio();
  await testAPIProvider();

  console.log('\n====================================');
  console.log('Connection tests complete!');
  console.log('====================================');
}

runTests().catch(console.error);