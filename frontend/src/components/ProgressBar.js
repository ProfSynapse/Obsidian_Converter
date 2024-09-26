import React from 'react';
import styled from 'styled-components';

const ProgressBarContainer = styled.div`
  width: 100%;
  background-color: #e0e0e0;
  border-radius: 4px;
  margin: 10px 0;
`;

const ProgressBarFill = styled.div`
  width: ${props => props.progress}%;
  height: 20px;
  background-color: #00A99D;
  border-radius: 4px;
  transition: width 0.3s ease-in-out;
`;

const ProgressBar = ({ progress }) => {
  return (
    <ProgressBarContainer>
      <ProgressBarFill progress={progress} />
    </ProgressBarContainer>
  );
};

export default ProgressBar;