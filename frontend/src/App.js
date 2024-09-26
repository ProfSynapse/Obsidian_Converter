// src/App.js
import React, { useState, useCallback } from 'react';
import styled from 'styled-components';
import Button from './components/Button';
import Input from './components/Input';
import FileInput from './components/FileInput';
import ProgressBar from './components/ProgressBar';
import Preview from './components/Preview';
import Instructions from './components/Instructions';
import { GlobalStyles } from './styles/GlobalStyles';
import { convertFiles } from './utils/api';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import logo from './components/logo.png';
import useFileUpload from './hooks/useFileUpload';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { debounce } from 'lodash';

const AppContainer = styled.div`
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
`;

const Card = styled.div`
  background: white;
  border-radius: 10px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  padding: 2rem;
  margin-bottom: 2rem;
`;

const Title = styled.h1`
  text-align: center;
  color: #00A99D;
  margin-bottom: 1rem;
`;

const Logo = styled.img`
  display: block;
  margin: 0 auto 1rem;
  max-width: 200px;
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const DropZone = styled.div`
  border: 2px dashed #00A99D;
  border-radius: 5px;
  padding: 2rem;
  text-align: center;
  cursor: pointer;
  transition: background-color 0.3s ease, border-color 0.3s ease;
  background-color: ${props => (props.isDragActive ? 'rgba(0, 169, 157, 0.1)' : 'transparent')};
  border-color: ${props => (props.isDragActive ? '#007f7a' : '#00A99D')};
`;

const UrlContainer = styled.div`
  display: flex;
  gap: 0.5rem;
  align-items: center;
`;

const UrlButton = styled(Button)`
  padding: 0.5rem;
  font-size: 1.5rem;
  line-height: 1;
  height: 38px;  // Adjust this value to match your Input height
  width: 38px;   // Make it square
  display: flex;
  align-items: center;
  justify-content: center;
`;

const DocumentTypeGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
  margin-bottom: 1rem;
`;

const DocumentTypeButton = styled(Button)`
  opacity: ${props => props.isSelected ? 1 : 0.6};
  background-color: ${props => props.isSelected ? '#00A99D' : '#e0e0e0'};
  color: ${props => props.isSelected ? 'white' : 'black'};

  &:hover {
    opacity: 1;
  }
`;

const ItemsContainer = styled.div`
  border: 1px solid #e0e0e0;
  border-radius: 5px;
  padding: 1rem;
  margin-bottom: 1rem;
`;

const ItemList = styled.ul`
  list-style-type: none;
  padding: 0;
  max-height: 200px;
  overflow-y: auto;
`;

const ListItem = styled.li`
  display: flex;
  align-items: center;
  padding: 0.5rem;
  background-color: #f0f0f0;
  margin-bottom: 0.5rem;
  border-radius: 4px;
`;

const RemoveButton = styled.button.attrs({
  'aria-label': 'Remove item',
})`
  background: none;
  border: none;
  color: red;
  cursor: pointer;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  
  &:hover {
    background-color: rgba(255, 0, 0, 0.1);
  }
`;

const ResultContainer = styled.div`
  margin-top: 1rem;
  text-align: center;
`;

const App = () => {
  const [apiKey, setApiKey] = useState('');
  const [currentUrl, setCurrentUrl] = useState('');
  const [outputFormat, setOutputFormat] = useState('markdown');
  const [status, setStatus] = useState('idle');
  const [progress, setProgress] = useState(0);
  const [convertedFiles, setConvertedFiles] = useState(null);
  const [isInstructionsOpen, setIsInstructionsOpen] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);

  const { items, setItems, handleFileChange, handleDrop, handleRemoveItem } = useFileUpload();

  // Debounced handler for URL input
  const debouncedSetCurrentUrl = useCallback(
    debounce((value) => {
      setCurrentUrl(value);
    }, 300),
    []
  );

  const handleUrlChange = (e) => {
    debouncedSetCurrentUrl(e.target.value);
  };

  const handleAddUrl = useCallback(() => {
    if (currentUrl) {
      setItems(prevItems => [...prevItems, { type: 'url', content: currentUrl }]);
      setCurrentUrl('');
      toast.success('URL added successfully!');
    }
  }, [currentUrl, setItems]);

  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    setIsDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setIsDragActive(false);
  }, []);

  const handleDropZoneDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragActive(false);
    handleDrop(e);
    toast.success('Files added successfully!');
  }, [handleDrop]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!apiKey) {
      toast.error('Please enter your OpenAI API key.');
      return;
    }

    if (items.length === 0) {
      toast.error('Please upload at least one file or add a URL.');
      return;
    }

    setStatus('processing');
    setProgress(0);
    toast.info('Conversion started!');

    try {
      const files = items.filter(item => item.type === 'file').map(item => item.content);
      const urls = items.filter(item => item.type === 'url').map(item => item.content);
      const response = await convertFiles(apiKey, files, urls, outputFormat, (progress) => {
        setProgress(progress);
      });
      setConvertedFiles(response);
      setStatus('completed');
      toast.success('Conversion completed successfully!');
    } catch (error) {
      console.error('Conversion error:', error);
      setStatus('error');
      toast.error('An error occurred during conversion.');
    }
  };

  const handleDownload = async () => {
    if (convertedFiles) {
      const zip = new JSZip();
      
      convertedFiles.forEach((file) => {
        zip.file(file.name, file.content);
      });
      
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      saveAs(zipBlob, 'converted_files.zip');
    }
  };

  return (
    <>
      <GlobalStyles />
      <ToastContainer />
      <AppContainer>
        <Card>
          <Logo src={logo} alt="Omni-Converter Logo" />
          <Title>Omni-Converter</Title>
          
          <Instructions 
            isOpen={isInstructionsOpen} 
            toggleOpen={() => setIsInstructionsOpen(!isInstructionsOpen)} 
          />

          <Form onSubmit={handleSubmit}>
            <Input
              type="password"
              placeholder="Enter your OpenAI API key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              required
              aria-label="OpenAI API Key"
            />
            
            <DropZone
              onDrop={handleDropZoneDrop}
              onDragOver={(e) => { e.preventDefault(); }}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onClick={() => document.getElementById('fileInput').click()}
              isDragActive={isDragActive}
              role="button"
              aria-label="File Upload Drop Zone"
              tabIndex="0"
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  document.getElementById('fileInput').click();
                }
              }}
            >
              Drag & drop files here or click to upload
            </DropZone>
            <FileInput
              id="fileInput"
              accept="*/*"
              multiple
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
            
            <UrlContainer>
              <Input
                type="url"
                placeholder="Enter URL"
                value={currentUrl}
                onChange={handleUrlChange}
                aria-label="URL Input"
              />
              <UrlButton type="button" onClick={handleAddUrl} aria-label="Add URL">+</UrlButton>
            </UrlContainer>
            
            {items.length > 0 && (
              <ItemsContainer>
                <ItemList>
                  {items.map((item, index) => (
                    <ListItem key={index}>
                      <Preview item={item} />
                      <span>{item.type === 'file' ? item.content.name : item.content}</span>
                      <RemoveButton onClick={() => handleRemoveItem(index)} aria-label={`Remove ${item.type === 'file' ? item.content.name : 'URL'}`}>×</RemoveButton>
                    </ListItem>
                  ))}
                </ItemList>
              </ItemsContainer>
            )}
            
            <DocumentTypeGrid>
              {['markdown', 'html', 'txt', 'json', 'yaml', 'xml', 'csv', 'pdf', 'docx'].map(format => (
                <DocumentTypeButton
                  key={format}
                  isSelected={outputFormat === format}
                  onClick={() => setOutputFormat(format)}
                  type="button"
                  aria-pressed={outputFormat === format}
                >
                  {format.toUpperCase()}
                </DocumentTypeButton>
              ))}
            </DocumentTypeGrid>
            
            <Button type="submit" disabled={status === 'processing'} aria-disabled={status === 'processing'}>
              {status === 'processing' ? 'Processing...' : 'Convert'}
            </Button>
          </Form>
          
          {status === 'processing' && <ProgressBar progress={progress} aria-valuenow={progress} aria-valuemin="0" aria-valuemax="100" />}
          
          {status === 'completed' && (
            <ResultContainer>
              <h2>Conversion Complete!</h2>
              <Button onClick={handleDownload}>Download ZIP</Button>
            </ResultContainer>
          )}
        </Card>
      </AppContainer>
    </>
  );
};

export default React.memo(App);
