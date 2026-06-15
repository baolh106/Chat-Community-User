pipeline {
    tools {
        nodejs: 'node-24'
    }

    environment {
        DEPLOY_DIR = '/root/app-chat/Chat-Community-User'
        USER_DIR = 'user'
        ADMIN_DIR = 'admin'
        TELEGRAM_TOKEN   = credentials('telegram-bot-token')
        TELEGRAM_CHAT_ID = credentials('telegram-chat-id')
    }

    stages {
        stage('📦 1. Pull code FE') {
            steps {
                checkout scm
            }
        }
        
        // ==========================================
        // KHỐI GIAO DIỆN USER
        // ==========================================
        stage("🔧 2.1 [${env.USER_DIR}] Install dependencies") {
            when { changeset "${env.USER_DIR}/**" }
            steps {
                echo '=== Phát hiện thay đổi ở folder USER: Cài đặt package ==='
                dir("${env.USER_DIR}") {
                    sh "npm ci"
                }
            }
        }
        
        stage("🏗️ 2.2 [${env.USER_DIR}] Build Frontend") {
            when { changeset "${env.USER_DIR}/**" }
            steps {
                echo '=== Phát hiện thay đổi ở folder USER: Build frontend ==='
                dir("${env.USER_DIR}") {
                    sh "cp /root/app-chat/Chat-Community-User/user/.env ./"
                    sh "npm run build"                }
            }
        }
        
        stage("🚀 2.3 [${env.USER_DIR}] Deploy Frontend") {
            when { changeset "${env.USER_DIR}/**" }
            steps {
                echo '=== Tạo folder deploy nếu chưa có ==='
                sh "mkdir -p ${env.DEPLOY_DIR}/${env.USER_DIR}/"
                
                echo '=== Sử dụng Rsync đồng bộ ruột folder dist sang folder chạy thật của Nginx ==='
                sh "rsync -av --delete ${env.USER_DIR}/dist/ ${env.DEPLOY_DIR}/${env.USER_DIR}/"
            }
        }

        // ==========================================
        // ⚙️ KHỐI XỬ LÝ CHO GIAO DIỆN ADMIN
        // ==========================================
        stage("🔧 3.1 [${env.ADMIN_DIR}] Install dependencies") {
            when { changeset "${env.ADMIN_DIR}/**" }
            steps {
                echo '=== Phát hiện thay đổi ở folder ADMIN: Cài đặt package ==='
                dir("${env.ADMIN_DIR}") {
                    sh "npm ci"
                }
            }
        }
        
        stage("🏗️ 3.2 [${env.ADMIN_DIR}] Build Frontend") {
            when { changeset "${env.ADMIN_DIR}/**" }
            steps {
                echo '=== Phát hiện thay đổi ở folder ADMIN: Build frontend ==='
                dir("${env.ADMIN_DIR}") {
                    sh "cp /root/app-chat/Chat-Community-User/user/.env ./"
                    sh "npm run build"                }
            }
        }
        
        stage("🚀 3.3 [${env.ADMIN_DIR}] Deploy Frontend") {
            when { changeset "${env.ADMIN_DIR}/**" }
            steps {
                echo '=== Tạo folder deploy nếu chưa có ==='
                sh "mkdir -p ${env.DEPLOY_DIR}/${env.ADMIN_DIR}/"
                
                echo '=== Sử dụng Rsync đồng bộ ruột folder dist sang folder chạy thật của Nginx ==='
                sh "rsync -av --delete ${env.ADMIN_DIR}/dist/ ${env.DEPLOY_DIR}/${env.ADMIN_DIR}/"
            }
        }
    }
    
    post {
        success {
            script {
                def message = "🎨 *JENKINS FRONTEND SUCCESS* 🚀%0A%0A" +
                              "📦 *Dự án:* ${env.JOB_NAME}%0A" +
                              "🔢 *Build số:* #${env.BUILD_NUMBER}%0A" +
                              "🔗 *Chi tiết:* [Xem tại đây](${env.BUILD_URL})"
                sh "curl -s -X POST https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/sendMessage -d chat_id=${env.TELEGRAM_CHAT_ID} -d text='${message}' -d parse_mode='Markdown'"
            }
        }
        failure {
            script {
                def message = "💥 *JENKINS FRONTEND FAILED* 🚨%0A%0A" +
                              "📦 *Dự án:* ${env.JOB_NAME}%0A" +
                              "🔢 *Build số:* #${env.BUILD_NUMBER}%0A" +
                              "🔗 *Kiểm tra log:* [Xem tại đây](${env.BUILD_URL}console)"
                sh "curl -s -X POST https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/sendMessage -d chat_id=${env.TELEGRAM_CHAT_ID} -d text='${message}' -d parse_mode='Markdown'"
            }
        }
    }
}